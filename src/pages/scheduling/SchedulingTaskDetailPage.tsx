import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import {
  useTask,
  useUpdateTask,
  useMoveTaskToStage,
  useDeleteTask,
  useSetTaskGeneralStatus,
  useSetTaskInventoryReview,
} from '@/hooks/useScheduling';
import { useConfirm } from '@/context/ConfirmContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { usePartners } from '@/hooks/usePartners';
import { useProjects } from '@/hooks/useProjects';
import { useClientDetail, useClientContracts } from '@/hooks/useCustomers';
import { buildContractLabel } from '@/lib/buildContractLabel';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import { useIClassSendFeedback } from '@/hooks/useIClassSendFeedback';
import { IClassSendResultModal } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';
import { IClassTeamSelector } from '@/components/molecules/IClassTeamSelector/IClassTeamSelector';
import type { ScheduledTask, TaskGeneralStatus } from '@/types/scheduling';
import { applyTaskVariables } from './lib/taskVariables';
import { TaskHeader } from './SchedulingTaskDetailPage/components/TaskHeader';
import { TaskTabs } from './SchedulingTaskDetailPage/components/TaskTabs';
import { CustomerSidebar } from './SchedulingTaskDetailPage/components/CustomerSidebar';
import type { DatosFormValues } from './SchedulingTaskDetailPage/components/DatosForm';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import type { WorkflowStage } from '@/types/workflow';
import styles from './SchedulingTaskDetailPage.module.css';

function mapError(err: unknown): string {
  const messages: Record<string, string> = {
    CUSTOMER_NOT_FOUND: 'Cliente no encontrado',
    TASK_NOT_FOUND: 'Tarea no encontrada',
    VALIDATION_ERROR: 'Datos inválidos',
    NETWORK_ERROR: 'Sin conexión. Reintentar',
  };
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { code?: string; message?: string } } }).response;
    const code = res?.data?.code;
    if (code && messages[code]) return messages[code];
    if (res?.data?.message) return res.data.message;
  }
  return 'Error al guardar. Reintentar';
}

export default function SchedulingTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: task, isLoading, isError } = useTask(id);
  const { data: workflows = [] } = useWorkflows();
  const { data: allRbacUsers = [] } = useRbacUsers();
  // `admins` (full catalog) powers Reporter resolution + Watchers picker:
  // the reporter or a watcher can be any user, not just a técnico.
  // `technicians` is the subset used by the "Asignado a" select on the
  // Datos form, because that field is the field técnico assigned to the
  // task in the field.
  const admins = allRbacUsers;
  const technicians = allRbacUsers.filter(u =>
    u.roles.some(r => r.code === 'tecnico'),
  );
  const { data: partners = [] } = usePartners();
  const { data: projects = [] } = useProjects();
  const { data: priorities = [] } = useTaskPriorities();
  // Customer detail + contracts — cached share with CustomerSidebar (same query keys).
  // Used only to resolve {{telefono}} / {{contrato}} / {{servicio}} in description merge variables.
  const customerId = task?.customerId ?? null;
  const { data: customerDetail } = useClientDetail(customerId ?? '');
  const { data: customerContracts = [] } = useClientContracts(customerId ?? '', !!customerId);

  useAuth(); // keep context subscription (auth:unauthorized event handling)
  const canDelete = useCan('scheduling.delete');

  const updateTask = useUpdateTask();
  const moveToStage = useMoveTaskToStage();
  const deleteTask = useDeleteTask();
  const setGeneralStatus = useSetTaskGeneralStatus();
  const confirm = useConfirm();
  const setInventoryReview = useSetTaskInventoryReview();
  const iclass = useIClassSendFeedback();
  // Last stageId attempted — used by the IClass modal's "Reintentar" CTA.
  const lastStageIdRef = useRef<string | null>(null);

  const [formDirty, setFormDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  // Description editor is controlled — parent stores the latest HTML so the
  // single bottom "Guardar cambios" can persist description + Datos in ONE
  // updateTask call. Initialised lazily by handleDescChange when the editor
  // fires its first onChange (no need to sync from task here).
  const [descriptionHtml, setDescriptionHtml] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [locationOverride, setLocationOverride] = useState<{
    address: string | null;
    coordinates: { lat: number; lng: number } | null;
  } | null>(null);

  const isDirty = formDirty || descDirty || titleDirty;

  // Warn before leaving with unsaved changes (browser tab close / external navigation).
  // useBlocker requires a data router; in-app navigation falls back to onbeforeunload.
  // MUST live inside useEffect with a cleanup that nulls the handler on unmount,
  // otherwise the dirty handler keeps firing on subsequent navigations (memory leak).
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleTitleSave = useCallback(async (title: string) => {
    if (!task) return;
    try {
      await updateTask.mutateAsync({ id: task.id, data: { title } });
      setTitleDirty(false);
      showToast('Título guardado');
    } catch (err) {
      showToast(mapError(err), 'error');
    }
  }, [task, updateTask]);

  const handleStageMove = useCallback(async (stageId: string) => {
    if (!task) return;
    lastStageIdRef.current = stageId;
    try {
      const updated = await moveToStage.mutateAsync({ id: task.id, stageId });
      const code = (updated as ScheduledTask | undefined)?.iclassOrderCode;
      if (code) {
        // IClass send succeeded — surface the OS code via the shared toast helper.
        iclass.handleSuccess(code);
      } else {
        showToast('Estado actualizado');
      }
    } catch (err) {
      // IClass errors open the result modal (MISSING_*, ICLASS_*). Everything
      // else falls back to the existing inline toast.
      if (!iclass.handleError(err)) {
        showToast(mapError(err), 'error');
      }
    }
  }, [task, moveToStage, iclass]);

  const handleIClassRetry = useCallback(() => {
    iclass.closeModal();
    const stageId = lastStageIdRef.current;
    if (stageId) void handleStageMove(stageId);
  }, [iclass, handleStageMove]);

  const handlePriorityChange = useCallback(async (priority: string) => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, data: { priority } });
    showToast('Prioridad actualizada');
  }, [task, updateTask]);

  // Description is controlled by this page — the editor pushes every change
  // here; the actual save is part of the unified handleFormSubmit below.
  const handleDescChange = useCallback((html: string, isDirty: boolean) => {
    setDescriptionHtml(html);
    setDescDirty(isDirty);
  }, []);

  const handleFormSubmit = useCallback(async (values: DatosFormValues) => {
    if (!task) return;
    const loc = locationOverride ?? { address: task.address, coordinates: task.coordinates };
    // Build the payload from Datos values, and ONLY add description when the
    // user actually edited it. Sending it unchanged would be a noisy write for
    // a field the user never touched.
    // Normalise the "Sin asignar / Sin partner / Sin servicio" selects: the UI
    // represents "no value" as the empty string `""` (the <option value="">),
    // but the API contract (UpdateTaskSchema) requires either a non-empty
    // string or null — an empty string fails `z.string().min(1)` and the
    // server replies 400 VALIDATION_ERROR. Convert "" → null at the boundary.
    const nullable = (v: string | null | undefined): string | null => (v && v.length > 0 ? v : null);
    const data: Parameters<typeof updateTask.mutateAsync>[0]['data'] = {
      projectId: nullable(values.projectId),
      assigneeId: nullable(values.assigneeId),
      partnerId: nullable(values.partnerId),
      contractId: nullable(values.contractId),
      startDate: values.startDate,
      endDate: values.endDate,
      travelTimeTo: values.travelTimeTo,
      travelTimeFrom: values.travelTimeFrom,
      address: loc.address,
      coordinates: loc.coordinates,
    };
    if (descDirty) {
      // Resolve {{cliente}} / {{telefono}} / {{contrato}} / {{servicio}} / {{direccion}} once
      // at save time using the task's linked entities; tokens with no value
      // stay as-is.
      const resolvedContract = customerContracts.find(s => String(s.id) === task.contractId) ?? null;
      const contratoLabel = resolvedContract ? buildContractLabel(resolvedContract) : null;
      data.description = applyTaskVariables(descriptionHtml, {
        cliente: task.customerName,
        telefono: customerDetail?.phone ?? null,
        contrato: contratoLabel,
        servicio: contratoLabel, // backward compat: {{servicio}} resolves to contract label
        direccion: task.address,
      });
    }
    try {
      await updateTask.mutateAsync({ id: task.id, data });
      setFormDirty(false);
      setDescDirty(false);
      setLocationOverride(null);
      showToast('Cambios guardados');
    } catch (err) {
      // Surface the API error to the user instead of producing an unhandled
      // promise rejection (DatosForm wraps the submit in `void`, which would
      // swallow the rejection silently into the console). Dirty state is
      // preserved so the user can correct and retry without losing input.
      showToast(mapError(err), 'error');
    }
  }, [task, updateTask, locationOverride, descDirty, descriptionHtml, customerDetail, customerContracts]);

  const handleWatcherChange = useCallback(async (nextIds: string[]) => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, data: { watcherIds: nextIds } });
    showToast('Watchers actualizados');
  }, [task, updateTask]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    await deleteTask.mutateAsync(task.id);
    setDeleteConfirm(false);
    showToast('Tarea eliminada');
    navigate('/admin/scheduling/projects');
  }, [task, deleteTask, navigate]);

  const STATUS_TOAST: Record<TaskGeneralStatus, string> = {
    open: 'Tarea reabierta',
    closed: 'Tarea cerrada',
    dismissed: 'Tarea descartada',
  };

  const handleSetStatus = useCallback(async (status: TaskGeneralStatus) => {
    if (!task) return;
    // Dismiss is the only destructive transition (drops the task out of the main
    // views and stops IClass reconciliation) — confirm it first.
    if (status === 'dismissed') {
      const ok = await confirm({
        title: 'Descartar tarea',
        message: '¿Descartar esta tarea? Saldrá de las vistas principales y dejará de reconciliarse con IClass.',
        confirmLabel: 'Descartar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await setGeneralStatus.mutateAsync({ id: task.id, status });
      showToast(STATUS_TOAST[status]);
    } catch (err) {
      showToast(mapError(err), 'error');
    }
  }, [task, setGeneralStatus, confirm]);

  const handleLocationChange = useCallback(
    (next: { address: string | null; coordinates: { lat: number; lng: number } | null }) => {
      setLocationOverride(next);
      setFormDirty(true);
    },
    []
  );

  const handleInventoryToggle = useCallback(async (next: boolean) => {
    if (!task) return;
    try {
      await setInventoryReview.mutateAsync({ id: task.id, reviewed: next });
      showToast(next ? 'Marcado como revisado por inventario' : 'Desmarcado de revisado por inventario');
    } catch (err) {
      showToast(mapError(err), 'error');
    }
  }, [task, setInventoryReview]);

  // Collect all stages from all workflows
  const allStages: WorkflowStage[] = workflows.flatMap(w => w.stages);

  if (isLoading) return <Spinner fullPage />;

  if (isError || !task) {
    return (
      <div className={styles.notFound}>
        <h1>Tarea no encontrada</h1>
        <p>La tarea que buscás no existe o fue eliminada.</p>
        <Link to="/admin/scheduling/projects" className={styles.backLink}>
          Volver a Scheduling
        </Link>
      </div>
    );
  }

  const formInitial: DatosFormValues = {
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    partnerId: task.partnerId,
    customerId: task.customerId,
    contractId: task.contractId,
    startDate: task.startDate,
    endDate: task.endDate,
    travelTimeTo: task.travelTimeTo,
    travelTimeFrom: task.travelTimeFrom,
    address: task.address,
    coordinates: task.coordinates,
  };

  const currentLocation = locationOverride ?? {
    address: task.address,
    coordinates: task.coordinates,
  };

  const isSaving = updateTask.isPending || moveToStage.isPending || deleteTask.isPending || setGeneralStatus.isPending;

  return (
    <div className={styles.page}>
      <TaskHeader
        task={task}
        stages={allStages}
        priorities={priorities}
        onTitleSave={handleTitleSave}
        onStageMove={handleStageMove}
        onPriorityChange={handlePriorityChange}
        onDelete={() => setDeleteConfirm(true)}
        onSetStatus={(status) => void handleSetStatus(status)}
        isAdmin={canDelete}
        isSaving={isSaving}
      />

      <div className={styles.layout}>
        <main className={styles.main}>
          {/* IClass team assignment — shown only with permission + flag ON and
              only when the task has an IClass OS (iclassOrderCode present) */}
          {task.iclassOrderCode && (
            <IClassTeamSelector taskId={task.id} />
          )}
          <TaskTabs
            detailsProps={{
              datosForm: {
                initial: formInitial,
                onSubmit: handleFormSubmit,
                isSaving: updateTask.isPending,
                admins: technicians,
                partners,
                projects,
                kind: task.kind,
                iclassOrderCode: task.iclassOrderCode ?? null,
                originalProjectId: task.projectId,
                onDirtyChange: setFormDirty,
              },
              ubicacionMap: {
                address: currentLocation.address,
                coordinates: currentLocation.coordinates,
                onChange: handleLocationChange,
              },
              descriptionEditor: {
                initialHtml: task.description,
                onChange: handleDescChange,
              },
              checklistSection: {
                taskId: id!,
                checklist: task.checklist ?? [],
                onError: (msg) => showToast(msg, 'error'),
              },
            }}
            commentsTaskId={id!}
            reviewedByInventory={task.reviewedByInventory}
            onInventoryToggle={handleInventoryToggle}
            reviewedByInventoryAt={task.reviewedByInventoryAt ?? null}
            reviewedByInventoryUserName={task.reviewedByInventoryUserName ?? null}
            ticketId={task.ticketId ?? null}
            ticketSubject={task.ticketSubject ?? null}
            contractId={task.contractId ?? null}
            iclassOrderCode={task.iclassOrderCode ?? null}
            projectAllowsRetirement={task.projectAllowsRetirement ?? false}
          />
        </main>

        <aside className={styles.sidebar}>
          <CustomerSidebar
            customerId={task.customerId}
            customerName={task.customerName}
            contractId={task.contractId}
            taskId={id ?? null}
            reporterId={task.reporterId}
            watcherIds={task.watcherIds}
            admins={admins}
            onWatchersChange={handleWatcherChange}
            isSavingWatchers={updateTask.isPending}
          />
        </aside>
      </div>

      {/* Toast */}
      {(toastMsg || iclass.toast) && (
        <div
          className={`${styles.toast} ${toastType === 'error' ? styles.toastError : styles.toastSuccess}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toastMsg ?? iclass.toast}
        </div>
      )}

      {/* IClass send result modal — same hook + component the list views use */}
      <IClassSendResultModal
        open={!!iclass.error}
        error={iclass.error}
        onClose={iclass.closeModal}
        onRetry={handleIClassRetry}
        taskId={task?.id}
        onResendSuccess={iclass.handleSuccess}
      />

      {/* Live region for save status */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly} />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className={styles.overlay} onClick={() => setDeleteConfirm(false)}>
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <h2 id="delete-dialog-title" className={styles.modalTitle}>¿Eliminar tarea?</h2>
            <p className={styles.modalBody}>
              Se eliminará <strong>{task.title}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setDeleteConfirm(false)}
                autoFocus
              >
                Cancelar
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => { void handleDelete(); }}
                disabled={deleteTask.isPending}
              >
                {deleteTask.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
