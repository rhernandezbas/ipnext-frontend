import { useMemo, useRef, useState } from 'react';
import { formatDateShort } from '@/utils/formatDate';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Can } from '@/components/auth/Can';
import type { ScheduledTask, TaskGeneralStatus } from '@/types/scheduling';
import type { Workflow, WorkflowStage } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { TaskPriority } from '@/types/taskPriority';

type SchedulingAssignee = { id: string; name: string };
import {
  useMoveTaskToStage,
  useBulkMoveTasksToStage,
  useDeleteTask,
  useCloseTask,
  useSetTaskInventoryReview,
  useUpdateTask,
  useSetTaskGeneralStatus,
  useArchiveTask,
} from '@/hooks/useScheduling';
import type { BulkStageResponse } from '@/api/scheduling.api';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import { useIClassSendFeedback } from '@/hooks/useIClassSendFeedback';
import { IClassSendResultModal } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';
import { BulkMoveResultModal } from '@/components/molecules/BulkMoveResultModal/BulkMoveResultModal';
import { StageSelect } from '@/components/molecules/StageSelect/StageSelect';
import { PrioritySelect } from '@/components/molecules/PrioritySelect/PrioritySelect';
import { useConfirm } from '@/context/ConfirmContext';
import { mapWithConcurrency } from '@/utils/mapWithConcurrency';
import styles from './TasksTableView.module.css';

/** Bulk requests run at most 5 in flight — mirrors the BE/tickets limit. */
const BULK_CONCURRENCY = 5;

/** Per-action toast copy: `done` = success past-participle, `failVerb` =
 *  infinitive for the partial-failure line ("X de N no se pudieron {failVerb}"). */
interface BulkCopy { done: string; failVerb: string; noun: string; }
const BULK_COPY = {
  assign:         { done: 'asignadas', failVerb: 'asignar',      noun: 'tarea' },
  changeStatus:   { done: 'actualizadas', failVerb: 'actualizar', noun: 'tarea' },
  close:          { done: 'cerradas', failVerb: 'cerrar',         noun: 'tarea' },
  delete:         { done: 'eliminadas', failVerb: 'eliminar',     noun: 'tarea' },
  archive:        { done: 'archivadas', failVerb: 'archivar',     noun: 'tarea' },
} satisfies Record<string, BulkCopy>;

// ── Atoms ────────────────────────────────────────────────────────────────────

/** Priority pill — colour comes from the editable TaskPriority catalog. Falls
 *  back to a neutral grey when the priority isn't found in the catalog. */
export function PriorityPill({ priority, color }: { priority: string; color?: string }) {
  const bg = color ?? '#e5e7eb';
  return (
    <span
      className={styles.priorityPill}
      style={{ backgroundColor: bg, color: '#fff' }}
      aria-label={`Prioridad: ${priority}`}
    >
      {priority}
    </span>
  );
}

/** Clickable indicator for the RV (Revisado por Inventario) column.
 *  #24 — toggling requires `inventory.write` (the BE route already enforces
 *  it); without the permission the indicator stays visible but read-only. */
function RvIndicator({
  taskId,
  reviewed,
  canWrite,
  onToggle,
}: {
  taskId: string;
  reviewed: boolean;
  canWrite: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      await onToggle(taskId, !reviewed);
    } finally {
      setBusy(false);
    }
  }

  if (!canWrite) {
    return (
      <span
        className={styles.rvReadonly}
        role="img"
        aria-label={reviewed ? 'RV: revisado' : 'RV: no revisado'}
        data-reviewed={String(reviewed)}
        title={reviewed ? 'Revisado por inventario' : 'No revisado (requiere permiso de inventario para cambiar)'}
        onClick={e => e.stopPropagation()}
      >
        <span className={styles.rvDot} data-reviewed={String(reviewed)} aria-hidden="true" />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={styles.rvBtn}
      disabled={busy}
      onClick={e => void handleClick(e)}
      aria-label={reviewed ? 'RV: revisado' : 'RV: no revisado'}
      data-reviewed={String(reviewed)}
      title={reviewed ? 'Revisado por inventario — clic para desmarcar' : 'No revisado — clic para marcar'}
    >
      <span className={styles.rvDot} data-reviewed={String(reviewed)} aria-hidden="true" />
    </button>
  );
}

// ── BulkActionBar ────────────────────────────────────────────────────────────

type PickerKind = null | 'assign' | 'changeStatus' | 'moveStage';

interface BulkActionBarProps {
  selectedIds: string[];
  availableStages: WorkflowStage[];
  admins: SchedulingAssignee[];
  /** Tasks data — needed to check if all selected are non-open (archive gate). */
  tasks: ScheduledTask[];
  onClear: () => void;
  onMoveStage: (ids: string[], stageId: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<{ failedItems: string[] }>;
  onClose: (ids: string[]) => Promise<{ failedItems: string[] }>;
  onAssign: (ids: string[], assigneeId: string) => Promise<{ failedItems: string[] }>;
  onChangeStatus: (ids: string[], status: TaskGeneralStatus) => Promise<{ failedItems: string[] }>;
  onArchive: (ids: string[]) => Promise<{ failedItems: string[] }>;
  canHardDelete: boolean;
}

function BulkActionBar({
  selectedIds,
  availableStages,
  admins,
  tasks,
  onClear,
  onMoveStage,
  onDelete,
  onClose,
  onAssign,
  onChangeStatus,
  onArchive,
  canHardDelete,
}: BulkActionBarProps) {
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerValue, setPickerValue] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  // NOTE: hooks must run before any early return — keep useConfirm above this.
  if (selectedIds.length === 0) return null;

  const count = selectedIds.length;
  const noun = `tarea${count !== 1 ? 's' : ''}`;

  // Archive is only available when ALL selected tasks are non-open (closed or dismissed).
  const selectedTasks = tasks.filter(t => selectedIds.includes(t.id));
  const hasOpenTasks = selectedTasks.some(t => (t.generalStatus ?? (t.isClosed ? 'closed' : 'open')) === 'open');

  function openPicker(kind: Exclude<PickerKind, null>) {
    setPickerValue('');
    setPicker(kind);
  }

  async function handleConfirmPicker() {
    if (!pickerValue) return;
    setBusy(true);
    try {
      let result: { failedItems: string[] } | undefined;
      if (picker === 'assign') result = await onAssign(selectedIds, pickerValue);
      else if (picker === 'changeStatus') result = await onChangeStatus(selectedIds, pickerValue as TaskGeneralStatus);
      else if (picker === 'moveStage') {
        await onMoveStage(selectedIds, pickerValue);
        onClear();
        setPicker(null);
        return;
      }
      setPicker(null);
      if (result && result.failedItems.length === 0) onClear();
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!(await confirm({ message: `¿Cerrar ${count} ${noun}?`, confirmLabel: 'Cerrar' }))) return;
    setBusy(true);
    try {
      const { failedItems } = await onClose(selectedIds);
      if (failedItems.length === 0) onClear();
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!(await confirm({ message: `¿Archivar ${count} ${noun}?`, confirmLabel: 'Archivar' }))) return;
    setBusy(true);
    try {
      const { failedItems } = await onArchive(selectedIds);
      if (failedItems.length === 0) onClear();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm({ message: `¿Eliminar ${count} ${noun}?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    setBusy(true);
    try {
      const { failedItems } = await onDelete(selectedIds);
      if (failedItems.length === 0) onClear();
    } finally {
      setBusy(false);
    }
  }

  const pickerTitle =
    picker === 'assign'
      ? `Asignar ${count} ${noun}`
      : picker === 'changeStatus'
      ? `Cambiar estado de ${count} ${noun}`
      : picker === 'moveStage'
      ? `Mover ${count} ${noun} a otro estado`
      : '';

  return (
    <>
      <div className={styles.bulkActionBar} data-testid="bulk-action-bar">
        <span className={styles.bulkLabel}>Acciones masivas</span>
        <span className={styles.bulkCount}>
          ✓ {count} {noun} seleccionada{count !== 1 ? 's' : ''}
        </span>

        <Can permission="scheduling.write">
          <button
            type="button"
            className={styles.bulkMoveBtn}
            onClick={() => openPicker('assign')}
            disabled={busy}
            data-testid="bulk-assign-btn"
          >
            Asignar
          </button>
        </Can>

        <Can permission="scheduling.write">
          <button
            type="button"
            className={styles.bulkMoveBtn}
            onClick={() => openPicker('changeStatus')}
            disabled={busy}
            data-testid="bulk-change-status-btn"
          >
            Cambiar estado
          </button>
        </Can>

        <Can permission="scheduling.move_stage">
          <button
            type="button"
            className={styles.bulkMoveBtn}
            onClick={() => openPicker('moveStage')}
            disabled={busy || availableStages.length === 0}
            aria-label="Mover estado"
          >
            Mover estado
          </button>
        </Can>

        <Can permission="scheduling.write">
          <button
            type="button"
            className={styles.bulkCloseBtn}
            onClick={() => void handleClose()}
            disabled={busy}
            data-testid="bulk-close-btn"
          >
            Cerrar
          </button>
        </Can>

        <Can permission="scheduling.write">
          <button
            type="button"
            className={styles.bulkMoveBtn}
            onClick={() => void handleArchive()}
            disabled={busy || hasOpenTasks}
            title={
              hasOpenTasks
                ? 'Solo se pueden archivar tareas cerradas o descartadas. Cerrá o descartá las tareas abiertas primero.'
                : `Archivar ${count} ${noun}`
            }
            data-testid="bulk-archive-btn"
          >
            Archivar
          </button>
        </Can>

        {canHardDelete && (
          <button
            type="button"
            className={styles.bulkDeleteBtn}
            onClick={() => void handleDelete()}
            disabled={busy}
            data-testid="bulk-delete-btn"
          >
            Eliminar
          </button>
        )}

        <button
          type="button"
          className={styles.bulkClear}
          onClick={onClear}
          aria-label="Limpiar selección"
        >
          Limpiar
        </button>
      </div>

      {picker && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="task-bulk-picker-title">
          <div className={styles.dialog}>
            <h2 id="task-bulk-picker-title" className={styles.dialogTitle}>
              {pickerTitle}
            </h2>
            <label className={styles.dialogLabel}>
              {picker === 'assign'
                ? 'Asignar a'
                : picker === 'changeStatus'
                ? 'Nuevo estado'
                : 'Nuevo estado de workflow'}
              <select
                value={pickerValue}
                onChange={e => setPickerValue(e.target.value)}
                className={styles.dialogSelect}
                autoFocus
              >
                <option value="">Seleccionar…</option>
                {picker === 'assign' && admins.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
                {picker === 'changeStatus' && (
                  <>
                    <option value="open">Abierta</option>
                    <option value="closed">Cerrada</option>
                    <option value="dismissed">Descartada</option>
                  </>
                )}
                {picker === 'moveStage' && availableStages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setPicker(null); setPickerValue(''); }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void handleConfirmPicker()}
                disabled={busy || !pickerValue}
              >
                {picker === 'assign'
                  ? (busy ? 'Asignando…' : 'Asignar')
                  : picker === 'changeStatus'
                  ? (busy ? 'Aplicando…' : 'Aplicar')
                  : (busy ? 'Moviendo…' : 'Mover')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── TasksTableView ────────────────────────────────────────────────────────────

interface TasksTableViewProps {
  tasks: ScheduledTask[];
  loading?: boolean;
  /** Stages available for the bulk "Mover estado" action (typically the workflow of the selected project) */
  availableStages?: WorkflowStage[];
  /** All projects — used to resolve each task's workflow for the inline estado selector. */
  projects?: Project[];
  /** All workflows (with stages) — used to map stageId → name and to populate the inline selector. */
  workflows?: Workflow[];
  /** Priority catalog — used to colour the priority pill from its editable colour. */
  priorities?: TaskPriority[];
  /** Admin catalog — used to resolve `reporterId → name` for the Reporter column.
   *  The same list already powers the assignee filter on the page, so passing
   *  it here avoids a denormalised `reporterName` field in the API DTO. */
  admins?: SchedulingAssignee[];
  /** Column keys that should be rendered. When undefined, all columns are shown. */
  visibleColumnKeys?: string[];
  /** Empty-state copy for the table (#40 FIX-4). Lets sibling pages override the
   *  default with a page-specific message (e.g. "No hay tareas de nodos…"). */
  emptyMessage?: string;
  /** When true the bulk action bar hides destructive actions (archive, delete).
   *  Use on the archived tasks page where those actions are contextually nonsensical. */
  readOnly?: boolean;
}

/** Full list of columns the table knows how to render — used both by the
 *  table itself and by the parent's <ColumnSelector /> dropdown. */
export const ALL_TASK_COLUMNS: { key: string; label: string }[] = [
  { key: 'sequenceNumber', label: '#' },
  { key: 'title',          label: 'Título' },
  { key: 'stageCategory',  label: 'Estado' },
  { key: 'projectName',    label: 'Proyecto' },
  { key: 'address',        label: 'Dirección' },
  { key: 'customerName',   label: 'Cliente' },
  { key: 'customerCity',   label: 'Localidad' },
  { key: 'startDate',      label: 'Inicio' },
  { key: 'assigneeName',   label: 'Asignado' },
  { key: 'reporterName',   label: 'Reporter' },
  { key: 'priority',       label: 'Prioridad' },
  { key: 'createdAt',             label: 'Fecha creación' },
  { key: 'updatedAt',             label: 'Fecha actualización' },
  { key: 'reviewedByInventory',   label: 'RV' },
];

const PAGE_SIZES = [10, 25, 50, 100];

export function TasksTableView({
  tasks,
  loading = false,
  availableStages = [],
  projects = [],
  workflows = [],
  priorities = [],
  admins = [],
  visibleColumnKeys,
  emptyMessage = 'No hay tareas para mostrar.',
  readOnly = false,
}: TasksTableViewProps) {
  const navigate = useNavigate();
  const moveToStage = useMoveTaskToStage();
  const bulkMoveToStage = useBulkMoveTasksToStage();
  const updateTask = useUpdateTask();
  const setGeneralStatus = useSetTaskGeneralStatus();
  const archiveTask = useArchiveTask();
  const iclass = useIClassSendFeedback();
  // Result of the last bulk "Mover estado" — drives BulkMoveResultModal.
  const [bulkResult, setBulkResult] = useState<BulkStageResponse | null>(null);
  // Stage the bulk move targeted, so "Reintentar las fallidas" re-runs the same move.
  const bulkStageId = useRef<string | null>(null);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const bulkToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showBulkToast(msg: string) {
    setBulkToast(msg);
    if (bulkToastTimer.current) clearTimeout(bulkToastTimer.current);
    bulkToastTimer.current = setTimeout(() => setBulkToast(null), 4000);
  }

  /**
   * Run a bulk action as N requests (concurrency 5). On full success: toast the
   * count and clear the selection. On partial failure: toast "X de N no se
   * pudieron {verbo}" and narrow the selection to ONLY the failed ids.
   */
  async function runBulk(
    ids: string[],
    fn: (id: string) => Promise<unknown>,
    copy: BulkCopy,
  ): Promise<{ failedItems: string[] }> {
    const { failedItems } = await mapWithConcurrency(ids, BULK_CONCURRENCY, fn);
    if (failedItems.length === 0) {
      showBulkToast(`${ids.length} ${copy.noun}${ids.length !== 1 ? 's' : ''} ${copy.done}`);
      setSelectedIds([]);
    } else {
      showBulkToast(`${failedItems.length} de ${ids.length} no se pudieron ${copy.failVerb}`);
      setSelectedIds(failedItems);
    }
    return { failedItems };
  }

  /**
   * Bulk move via the endpoint that returns a per-task result. On a full success
   * we toast; on a partial failure we open the result modal so the user can see
   * which tasks failed (and why) and retry only those.
   */
  async function handleBulkMove(ids: string[], stageId: string) {
    bulkStageId.current = stageId;
    const res = await bulkMoveToStage.mutateAsync({ ids, stageId });
    if (res.summary.failed > 0) {
      setBulkResult(res);
    } else {
      showBulkToast(`${res.summary.ok} de ${res.summary.total} tarea(s) enviada(s) a IClass.`);
    }
  }

  /** Retry only the still-failing tasks. Update the modal with the new result,
   *  or close it (and toast) when nothing fails anymore. */
  async function handleBulkRetry(failedIds: string[]) {
    const stageId = bulkStageId.current;
    if (!stageId || failedIds.length === 0) return;
    const res = await bulkMoveToStage.mutateAsync({ ids: failedIds, stageId });
    if (res.summary.failed > 0) {
      setBulkResult(res);
    } else {
      setBulkResult(null);
      showBulkToast(`${res.summary.ok} de ${res.summary.total} tarea(s) enviada(s) a IClass.`);
    }
  }
  // Remember the last IClass move so "Reintentar" / "Editar tarea" know the task.
  const lastMove = useRef<{ id: string; stageId: string } | null>(null);
  const deleteTask = useDeleteTask();
  const closeTask = useCloseTask();
  const setInventoryReview = useSetTaskInventoryReview();
  useAuth(); // keep context subscription (auth:unauthorized event handling)
  const canHardDelete = useCan('scheduling.hard_delete');
  const canInventoryWrite = useCan('inventory.write'); // #24 — gates the RV toggle
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.ceil(tasks.length / pageSize);
  const pageData = tasks.slice((page - 1) * pageSize, page * pageSize);

  // stageId → its workflow's stages, so each row's estado selector lists the
  // right options. All stages are unique across workflows, so a flat index works.
  const { stagesByWorkflow, workflowByStageId } = useMemo(() => {
    const byWf = new Map<string, WorkflowStage[]>();
    const wfByStage = new Map<string, string>();
    for (const w of workflows) {
      const sorted = [...w.stages].sort((a, b) => a.order - b.order);
      byWf.set(w.id, sorted);
      for (const s of sorted) wfByStage.set(s.id, w.id);
    }
    return { stagesByWorkflow: byWf, workflowByStageId: wfByStage };
  }, [workflows]);

  /** Stages of a task's project workflow (falls back to the workflow that owns
   *  the task's current stage when the project isn't resolvable). */
  function stagesForTask(t: ScheduledTask): WorkflowStage[] {
    const project = projects.find(p => p.id === t.projectId);
    const wfId = project?.workflowId ?? workflowByStageId.get(t.stageId);
    return wfId ? stagesByWorkflow.get(wfId) ?? [] : [];
  }

  /**
   * Move a task to a stage with IClass feedback. On error, if it is an IClass
   * send error we open the result modal and swallow it (the StageSelect just
   * reverts its busy state); otherwise we re-throw so existing error handling
   * still applies. On success we surface the OS code via toast.
   */
  async function handleMove(id: string, stageId: string) {
    lastMove.current = { id, stageId };
    try {
      const updated = await moveToStage.mutateAsync({ id, stageId });
      iclass.handleSuccess((updated as ScheduledTask | undefined)?.iclassOrderCode);
    } catch (err) {
      // IClass errors open the result modal; other errors have no table UI, so
      // we log them (the StageSelect just reverts its busy state) instead of
      // leaking an unhandled rejection.
      if (!iclass.handleError(err)) console.error('Failed to move task to stage', err);
    }
  }

  function handleRetry() {
    iclass.closeModal();
    if (lastMove.current) void handleMove(lastMove.current.id, lastMove.current.stageId);
  }

  /** Inline priority edit — mirrors handleMove's UX for the priority column. */
  async function handlePriorityChange(id: string, priority: string) {
    await updateTask.mutateAsync({ id, data: { priority } });
  }

  function handleEditTask() {
    iclass.closeModal();
    if (lastMove.current) navigate(`/admin/scheduling/tasks/${lastMove.current.id}`);
  }

  const ALL_COLUMNS = [
    { label: '#',         key: 'sequenceNumber', sortable: true,
      render: (t: ScheduledTask) => (
        <Link to={`/admin/scheduling/tasks/${t.id}`} className={styles.idLink}>
          #{t.sequenceNumber}
        </Link>
      ) },
    { label: 'Título',    key: 'title',          sortable: true,
      render: (t: ScheduledTask) => {
        // #41 — pill by generalStatus (closed / dismissed). Fall back to the
        // legacy isClosed flag for fixtures/DTOs that pre-date generalStatus.
        const status = t.generalStatus ?? (t.isClosed ? 'closed' : 'open');
        return (
        <span className={status !== 'open' ? styles.closedRow : undefined}>
          <Link to={`/admin/scheduling/tasks/${t.id}`} className={styles.titleLink} title={t.title}>
            {t.title}
          </Link>
          {status !== 'open' && (
            <span
              className={styles.closedBadge}
              data-testid="task-status-badge"
              data-status={status}
              aria-label={status === 'closed' ? 'Tarea cerrada' : 'Tarea descartada'}
            >
              {status === 'closed' ? 'Cerrada' : 'Descartada'}
            </span>
          )}
          {t.kind === 'network' && (
            <span
              className={styles.networkBadge}
              data-testid="network-badge"
              aria-label="Tarea de red"
            >
              {t.networkType === 'fibra' ? 'Nodo Fibra' : 'RED'}
            </span>
          )}
        </span>
        );
      } },
    { label: 'Estado',    key: 'stageCategory',  sortable: false,
      render: (t: ScheduledTask) => (
        <StageSelect
          task={t}
          stages={stagesForTask(t)}
          onMove={stageId => handleMove(t.id, stageId)}
        />
      ) },
    { label: 'Proyecto',  key: 'projectName',    sortable: true },
    { label: 'Dirección', key: 'address',        sortable: true },
    { label: 'Cliente',   key: 'customerName',   sortable: true,
      render: (t: ScheduledTask) => (
        t.customerId && t.customerName
          ? <Link
              to={`/admin/customers/view/${t.customerId}`}
              className={styles.customerLink}
              title={t.customerName}
              onClick={e => e.stopPropagation()}
            >{t.customerName}</Link>
          : (t.customerName || '—')
      ) },
    { label: 'Localidad', key: 'customerCity',   sortable: true,
      render: (t: ScheduledTask) => t.customerCity || '—' },
    { label: 'Inicio',    key: 'startDate',      sortable: true,
      render: (t: ScheduledTask) => formatDateShort(t.startDate) },
    { label: 'Asignado',  key: 'assigneeName',   sortable: true },
    { label: 'Reporter',  key: 'reporterName',   sortable: true,
      // Resolve reporterId → admin name from the admin catalog. Fall back to
      // an em-dash when there's no reporter or the id no longer matches any
      // admin (deleted user / stale data) — never leak the raw uuid to the UI.
      render: (t: ScheduledTask) => admins.find(a => a.id === t.reporterId)?.name ?? '—' },
    { label: 'Prioridad', key: 'priority',       sortable: true,
      render: (t: ScheduledTask) => (
        <PrioritySelect
          value={t.priority}
          priorities={priorities}
          onChange={(name) => handlePriorityChange(t.id, name)}
        />
      ) },
    { label: 'Fecha creación',      key: 'createdAt', sortable: true,
      render: (t: ScheduledTask) => formatDateShort(t.createdAt) },
    { label: 'Fecha actualización', key: 'updatedAt', sortable: true,
      render: (t: ScheduledTask) => formatDateShort(t.updatedAt) },
    { label: 'RV', key: 'reviewedByInventory', sortable: false,
      render: (t: ScheduledTask) => (
        <RvIndicator
          taskId={t.id}
          reviewed={t.reviewedByInventory}
          canWrite={canInventoryWrite}
          onToggle={(id, next) => setInventoryReview.mutateAsync({ id, reviewed: next })}
        />
      ) },
  ];

  // Build COLUMNS in the EXACT order of visibleColumnKeys (drag-to-reorder).
  // When the prop is undefined (legacy callers), fall back to the canonical
  // ALL_COLUMNS order.
  const COLUMNS = visibleColumnKeys
    ? visibleColumnKeys
        .map(k => ALL_COLUMNS.find(c => c.key === k))
        .filter((c): c is typeof ALL_COLUMNS[number] => !!c)
    : ALL_COLUMNS;

  const ACTIONS = [
    { label: 'Ver detalle', onClick: (t: ScheduledTask) => navigate(`/admin/scheduling/tasks/${t.id}`) },
  ];

  return (
    <div className={styles.wrapper}>
      {/* Bulk action bar — inline panel, shown above the table when rows are selected.
          Suppressed entirely on the archived view (readOnly): archived tasks are
          terminal; operational bulk actions don't apply there. */}
      {!readOnly && (
        <BulkActionBar
          selectedIds={selectedIds}
          availableStages={availableStages}
          admins={admins}
          tasks={tasks}
          onClear={() => setSelectedIds([])}
          onMoveStage={handleBulkMove}
          onClose={(ids) =>
            runBulk(ids, id => closeTask.mutateAsync({ id, isClosed: true }), BULK_COPY.close)
          }
          onAssign={(ids, assigneeId) =>
            runBulk(ids, id => updateTask.mutateAsync({ id, data: { assigneeId } }), BULK_COPY.assign)
          }
          onChangeStatus={(ids, status) =>
            runBulk(ids, id => setGeneralStatus.mutateAsync({ id, status }), BULK_COPY.changeStatus)
          }
          onArchive={(ids) =>
            runBulk(ids, id => archiveTask.mutateAsync(id), BULK_COPY.archive)
          }
          onDelete={(ids) =>
            runBulk(ids, id => deleteTask.mutateAsync(id), BULK_COPY.delete)
          }
          canHardDelete={canHardDelete}
        />
      )}
      <DataTable
        columns={COLUMNS}
        data={pageData}
        loading={loading}
        actions={ACTIONS}
        selectable={!readOnly}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage={emptyMessage}
      />

      {/* Pagination */}
      {tasks.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Mostrando {Math.min((page - 1) * pageSize + 1, tasks.length)}–{Math.min(page * pageSize, tasks.length)} de {tasks.length}
          </span>
          <div className={styles.paginationControls}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className={styles.pageSizeSelect}
            aria-label="Tamaño de página"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} por página</option>)}
          </select>
        </div>
      )}

      <IClassSendResultModal
        open={!!iclass.error}
        error={iclass.error}
        onClose={iclass.closeModal}
        onRetry={handleRetry}
        onEditTask={handleEditTask}
      />

      <BulkMoveResultModal
        open={!!bulkResult}
        summary={bulkResult?.summary ?? { total: 0, ok: 0, failed: 0 }}
        results={bulkResult?.results ?? []}
        labelForTask={(id) => {
          const t = tasks.find(x => x.id === id);
          return t ? `#${t.sequenceNumber} — ${t.title}` : id;
        }}
        onRetryFailed={ids => void handleBulkRetry(ids)}
        onClose={() => setBulkResult(null)}
      />

      {(iclass.toast || bulkToast) && (
        <div className={styles.iclassToast} role="status" aria-live="polite" aria-atomic="true">
          {iclass.toast ?? bulkToast}
        </div>
      )}
    </div>
  );
}
