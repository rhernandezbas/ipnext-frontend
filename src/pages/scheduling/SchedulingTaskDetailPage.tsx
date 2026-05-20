import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useTask, useUpdateTask, useMoveTaskToStage, useDeleteTask } from '@/hooks/useScheduling';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAdmins } from '@/hooks/useAdmins';
import { usePartners } from '@/hooks/usePartners';
import { TaskHeader } from './SchedulingTaskDetailPage/components/TaskHeader';
import { DescriptionEditor } from './SchedulingTaskDetailPage/components/DescriptionEditor';
import { DatosForm } from './SchedulingTaskDetailPage/components/DatosForm';
import type { DatosFormValues } from './SchedulingTaskDetailPage/components/DatosForm';
import { UbicacionMap } from './SchedulingTaskDetailPage/components/UbicacionMap';
import { WatchersChips } from './SchedulingTaskDetailPage/components/WatchersChips';
import { CustomerCard } from './SchedulingTaskDetailPage/components/CustomerCard';
import { ServiceCard } from './SchedulingTaskDetailPage/components/ServiceCard';
import { ReporterCard } from './SchedulingTaskDetailPage/components/ReporterCard';
import type { TaskPriority } from '@/types/scheduling';
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
  const { data: admins = [] } = useAdmins();
  const { data: partners = [] } = usePartners();

  const updateTask = useUpdateTask();
  const moveToStage = useMoveTaskToStage();
  const deleteTask = useDeleteTask();

  const [formDirty, setFormDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
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
    await moveToStage.mutateAsync({ id: task.id, stageId });
    showToast('Etapa actualizada');
  }, [task, moveToStage]);

  const handlePriorityChange = useCallback(async (priority: TaskPriority) => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, data: { priority } });
    showToast('Prioridad actualizada');
  }, [task, updateTask]);

  const handleDescSave = useCallback(async (html: string) => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, data: { description: html } });
    setDescDirty(false);
    showToast('Descripción guardada');
  }, [task, updateTask]);

  const handleFormSubmit = useCallback(async (values: DatosFormValues) => {
    if (!task) return;
    const loc = locationOverride ?? { address: task.address, coordinates: task.coordinates };
    await updateTask.mutateAsync({
      id: task.id,
      data: {
        assigneeId: values.assigneeId,
        partnerId: values.partnerId,
        serviceId: values.serviceId,
        startDate: values.startDate,
        endDate: values.endDate,
        travelTimeTo: values.travelTimeTo,
        travelTimeFrom: values.travelTimeFrom,
        address: loc.address,
        coordinates: loc.coordinates,
      },
    });
    setFormDirty(false);
    setLocationOverride(null);
    showToast('Cambios guardados');
  }, [task, updateTask, locationOverride]);

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

  const handleLocationChange = useCallback(
    (next: { address: string | null; coordinates: { lat: number; lng: number } | null }) => {
      setLocationOverride(next);
      setFormDirty(true);
    },
    []
  );

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
    serviceId: task.serviceId,
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

  const isSaving = updateTask.isPending || moveToStage.isPending || deleteTask.isPending;

  return (
    <div className={styles.page}>
      <TaskHeader
        task={task}
        stages={allStages}
        onTitleSave={handleTitleSave}
        onStageMove={handleStageMove}
        onPriorityChange={handlePriorityChange}
        onDelete={() => setDeleteConfirm(true)}
        isSaving={isSaving}
      />

      <div className={styles.layout}>
        <main className={styles.main}>
          <DatosForm
            initial={formInitial}
            onSubmit={handleFormSubmit}
            isSaving={updateTask.isPending}
            admins={admins}
            partners={partners}
            onDirtyChange={setFormDirty}
          />

          <UbicacionMap
            address={currentLocation.address}
            coordinates={currentLocation.coordinates}
            onChange={handleLocationChange}
          />

          <DescriptionEditor
            initialHtml={task.description}
            onSave={handleDescSave}
            isSaving={updateTask.isPending}
          />

          <section className={styles.checklistPlaceholder} aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className={styles.sectionTitle}>▣ Lista de verificación</h2>
            <p className={styles.comingSoon}>Próximamente — change 5</p>
          </section>
        </main>

        <aside className={styles.sidebar}>
          <CustomerCard customerId={task.customerId} customerName={task.customerName} />
          <ServiceCard serviceId={task.serviceId} customerId={task.customerId} />
          <ReporterCard reporterId={task.reporterId} allAdmins={admins} />
          <WatchersChips
            watcherIds={task.watcherIds}
            allAdmins={admins}
            onChange={handleWatcherChange}
            isSaving={updateTask.isPending}
          />
        </aside>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          className={`${styles.toast} ${toastType === 'error' ? styles.toastError : styles.toastSuccess}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toastMsg}
        </div>
      )}

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
