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
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { useIClassTechnicianTeams } from '@/hooks/useIClassTechnicianTeams';
import type { ScheduledTask, TaskGeneralStatus } from '@/types/scheduling';
import { applyTaskVariables } from './lib/taskVariables';
import { TaskHeader } from './SchedulingTaskDetailPage/components/TaskHeader';
import { TaskTabs } from './SchedulingTaskDetailPage/components/TaskTabs';
import { CustomerSidebar } from './SchedulingTaskDetailPage/components/CustomerSidebar';
import { ProvisionOnuSection } from './SchedulingTaskDetailPage/components/ProvisionOnuSection';
import type { DatosFormValues } from './SchedulingTaskDetailPage/components/DatosForm';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import type { WorkflowStage } from '@/types/workflow';
import { arHour, arMinute } from '@/utils/formatDate';
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

  // #122 — IClass cuadrilla block on the assignee picker.
  // With the `iclass-assign-action` flag ON, the Datos form blocks picking a
  // técnico that has no IClass cuadrilla mapped (Config → IClass → Técnicos).
  // With the flag OFF, assignment is free (no block). The actual modal + revert
  // lives in DatosForm; the parent just supplies the flag state + a lookup.
  //
  // FAIL-OPEN (FIX-FIRST #1): the block is decided from a Set built off
  // useIClassTechnicianTeams(). While that query is loading (data undefined) or
  // if it errored, the Set is empty → technicianHasTeam returns false for ALL
  // técnicos → with the flag ON we'd block EVERYONE (even técnicos who DO have a
  // cuadrilla), and a permanent block on error. So the block only activates when
  // BOTH the flag AND the mapping resolved successfully. If either is still
  // loading or errored → DON'T block (better to let through than to block all on
  // a network hiccup). Same load criterion applies to the flag for consistency.
  const flagQuery = useFeatureFlag('iclass-assign-action');
  const teamsQuery = useIClassTechnicianTeams();
  const flagLoaded = !flagQuery.isLoading && !flagQuery.isError;
  const teamsLoaded = !teamsQuery.isLoading && !teamsQuery.isError;
  const iclassAssignActive =
    (flagQuery.data?.enabled ?? false) && flagLoaded && teamsLoaded;
  const technicianTeams = teamsQuery.data ?? [];
  // A técnico HAS a cuadrilla when its mapping has a non-null iclassTeamLogin.
  const techniciansWithTeam = new Set(
    technicianTeams
      .filter(m => m.iclassTeamLogin !== null)
      .map(m => m.userId),
  );
  const technicianHasTeam = useCallback(
    // #6 — a falsy userId can never have a cuadrilla (and would never be in the
    // Set anyway); short-circuit to false to be explicit.
    (userId: string) => (userId ? techniciansWithTeam.has(userId) : false),
    // Recompute the lookup only when the mapping set changes (key is stable per data).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [technicianTeams],
  );
  // Collect all stages from all workflows — must be above handleStageMove so the
  // #130 validator can look up the target stage's code before the move fires.
  const allStages: WorkflowStage[] = workflows.flatMap(w => w.stages);

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

  // #130 — IClass pre-move validator modal.
  // Non-null when the move was blocked due to missing técnico or invalid window.
  const [iclassValidationMsg, setIclassValidationMsg] = useState<string | null>(null);

  const [formDirty, setFormDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  // Description editor is controlled — parent stores the latest HTML so the
  // single bottom "Guardar cambios" can persist description + Datos in ONE
  // updateTask call. Initialised lazily by handleDescChange when the editor
  // fires its first onChange (no need to sync from task here).
  const [descriptionHtml, setDescriptionHtml] = useState<string>('');
  // H1 (K2-FE fix wave) — protección contra lost-update de la descripción.
  // El BE appendea el bloque de aprovisionamiento a la descripción y la
  // invalidación refetchea el task, pero TipTap se inicializa UNA vez: si el
  // operador tenía la descripción dirty y guardaba, su HTML local (SIN el
  // bloque) PISABA las credenciales en el servidor.
  //  - lastSyncedDescRef: última descripción del servidor con la que el editor
  //    está alineado (baseline).
  //  - descResyncNonce: bump → DescriptionEditor reemplaza su contenido por el
  //    de servidor (solo cuando NO hay edición local).
  //  - descConflict: hay edición local Y el servidor cambió → banner + el
  //    guardado exige confirm explícito.
  const lastSyncedDescRef = useRef<string | null | undefined>(undefined);
  const [descResyncNonce, setDescResyncNonce] = useState(0);
  const [descConflict, setDescConflict] = useState(false);
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

  // H1 — vigila la descripción del servidor contra el baseline del editor:
  //  · primera carga → fija el baseline;
  //  · cambio de servidor SIN edición local → resync silencioso del editor;
  //  · cambio de servidor CON edición local → conflicto (banner + confirm al guardar).
  // Nota (edge aceptado): si el operador revierte su edición a mano DESPUÉS del
  // conflicto, el próximo run (descDirty→false) dispara el resync limpio.
  const serverDesc = task?.description;
  useEffect(() => {
    if (serverDesc === undefined) return; // el task todavía no cargó
    if (lastSyncedDescRef.current === undefined) {
      lastSyncedDescRef.current = serverDesc;
      return;
    }
    if (serverDesc === lastSyncedDescRef.current) return;
    if (!descDirty) {
      lastSyncedDescRef.current = serverDesc;
      setDescriptionHtml(serverDesc ?? '');
      setDescResyncNonce(n => n + 1);
      setDescConflict(false);
    } else {
      setDescConflict(true);
    }
  }, [serverDesc, descDirty]);

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

    // #130 — IClass pre-move validator.
    // When the operator moves to `send_to_iclass` with the flag ON, we validate:
    // (1) a técnico is assigned, (2) the task has a valid time window (08:00–20:00
    // local, start < end). If any condition fails we show a blocking modal and
    // abort the move. When the flag is OFF the move proceeds as before (no-op).
    const targetStage = allStages.find(s => s.id === stageId);
    if (targetStage?.code === 'send_to_iclass' && iclassAssignActive) {
      const problems: string[] = [];
      if (!task.assigneeId) {
        problems.push('un técnico asignado');
      }
      const start = task.startDate ? new Date(task.startDate) : null;
      const end = task.endDate ? new Date(task.endDate) : null;
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        problems.push('un horario (inicio y fin)');
      } else {
        const startH = arHour(start);
        const endH = arHour(end);
        const endM = arMinute(end);
        // Valid window: 08:00 ≤ start, end ≤ 20:00 (20:00:00 exact is allowed,
        // 20:01 is not), and start < end.
        const startOk = startH >= 8;
        const endOk = endH < 20 || (endH === 20 && endM === 0);
        const orderOk = start.getTime() < end.getTime();
        if (!startOk || !endOk || !orderOk) {
          problems.push('un horario válido entre las 8 y las 20 hs');
        }
      }
      if (problems.length > 0) {
        setIclassValidationMsg(
          `Para registrar en IClass la tarea necesita: ${problems.join(' y ')}. Editá la tarea y reintentá.`,
        );
        return; // BLOCK the move
      }
    }

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
  }, [task, moveToStage, iclass, allStages, iclassAssignActive]);

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
    // H1 — la descripción local va a PISAR una versión del servidor que el
    // operador no vio (p. ej. el bloque de aprovisionamiento de la ONU con las
    // credenciales). Guardar exige un confirm explícito que lo diga.
    if (descDirty && descConflict) {
      const ok = await confirm({
        title: 'La descripción cambió en el servidor',
        message:
          'Mientras editabas, la descripción de la tarea cambió en el servidor ' +
          '(p. ej. el bloque de aprovisionamiento de la ONU con sus credenciales) ' +
          'y ese contenido NO está en tu copia local. Si guardás, tu versión PISA ' +
          'la del servidor y ese contenido se pierde.',
        confirmLabel: 'Guardar y pisar',
        tone: 'danger',
      });
      if (!ok) return;
    }
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
      // H1 — lo que acabamos de guardar ES ahora la versión del servidor:
      // mover el baseline y limpiar el conflicto (si lo hubo, fue confirmado).
      if (data.description !== undefined) {
        lastSyncedDescRef.current = data.description;
        setDescConflict(false);
      }
      showToast('Cambios guardados');
    } catch (err) {
      // Surface the API error to the user instead of producing an unhandled
      // promise rejection (DatosForm wraps the submit in `void`, which would
      // swallow the rejection silently into the console). Dirty state is
      // preserved so the user can correct and retry without losing input.
      showToast(mapError(err), 'error');
    }
  }, [task, updateTask, locationOverride, descDirty, descConflict, confirm, descriptionHtml, customerDetail, customerContracts]);

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

  if (isLoading) return <Spinner fullPage />;

  if (isError || !task) {
    return (
      <div className={styles.notFound}>
        <h1>Tarea no encontrada</h1>
        <p>La tarea que buscás no existe o fue eliminada.</p>
        <Link to="/admin/scheduling/tasks" className={styles.backLink}>
          Volver a Tareas
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

      {/* H1 — conflicto de descripción: el servidor tiene contenido (p. ej. el
          bloque de aprovisionamiento) que NO está en la copia local dirty. */}
      {descConflict && (
        <div className={styles.conflictBanner} role="alert">
          La descripción cambió en el servidor — el bloque de aprovisionamiento
          NO está en tu copia local. Si guardás, pisás la versión del servidor.
        </div>
      )}

      <div className={styles.layout}>
        <main className={styles.main}>
          {/* K2-FE (smartolt-provision-fe) — aprovisionamiento de ONU fibra.
              La tecnología viene del CONTRATO vinculado (la tarea no la lleva);
              customerContracts ya está cacheado (misma query del sidebar). El
              gate fino (permiso/categoría/tecnología) vive en la sección. */}
          <ProvisionOnuSection
            taskCategory={task.category}
            contractId={task.contractId}
            contractTechnology={
              customerContracts.find(c => String(c.id) === task.contractId)?.technology
            }
          />
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
                // #122 — drives the assignee cuadrilla block (modal + revert).
                iclassAssignActive,
                technicianHasTeam,
              },
              ubicacionMap: {
                address: currentLocation.address,
                coordinates: currentLocation.coordinates,
                onChange: handleLocationChange,
              },
              descriptionEditor: {
                initialHtml: task.description,
                onChange: handleDescChange,
                // H1 — bump cuando el servidor cambió la descripción y no hay
                // edición local: el editor reemplaza su contenido.
                resyncNonce: descResyncNonce,
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

      {/* #130 — IClass pre-move validator: shown when operator tries to move to
          send_to_iclass without a técnico or a valid time window. Single-action
          (hideCancel) — operator must acknowledge and fix the task first. */}
      <ConfirmModal
        open={iclassValidationMsg !== null}
        title="Falta info para registrar en IClass"
        message={iclassValidationMsg ?? ''}
        confirmLabel="Entendido"
        tone="danger"
        hideCancel
        onConfirm={() => setIclassValidationMsg(null)}
        onCancel={() => setIclassValidationMsg(null)}
      />

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
