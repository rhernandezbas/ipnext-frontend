import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { ScheduledTask, TaskStageCategory } from '@/types/scheduling';
import type { Workflow, WorkflowStage } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { TaskPriority } from '@/types/taskPriority';
import { useMoveTaskToStage, useDeleteTask } from '@/hooks/useScheduling';
import styles from './TasksTableView.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<TaskStageCategory, string> = {
  nuevo:      'Nuevo',
  enProgreso: 'En progreso',
  hecho:      'Hecho',
  cancelado:  'Cancelado',
};

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

function StageBadge({ stageCategory }: { stageCategory: TaskStageCategory }) {
  return (
    <span className={styles.stageBadge} data-category={stageCategory}>
      {CATEGORY_LABEL[stageCategory]}
    </span>
  );
}

/**
 * Inline editable estado. Shows the REAL stage name (e.g. "Confirmado"), not the
 * broad category, and lets the user move the task to any stage of its project's
 * workflow without opening the task. Colour follows the current stage category.
 */
function StageSelect({
  task,
  stages,
  onMove,
}: {
  task: ScheduledTask;
  stages: WorkflowStage[];
  onMove: (stageId: string) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const current = stages.find(s => s.id === task.stageId);
  const category = current?.category ?? task.stageCategory;
  // Per-stage editable colour overrides the category default when set.
  const customColor = current?.color ?? undefined;

  // No workflow stages resolved → fall back to the read-only category badge.
  if (stages.length === 0) return <StageBadge stageCategory={task.stageCategory} />;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stageId = e.target.value;
    if (stageId === task.stageId) return;
    setBusy(true);
    try {
      await onMove(stageId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className={styles.stageSelect}
      data-category={category}
      style={customColor ? { backgroundColor: customColor, color: '#fff' } : undefined}
      value={task.stageId}
      onChange={handleChange}
      disabled={busy}
      aria-label="Cambiar estado"
      onClick={e => e.stopPropagation()}
    >
      {stages.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

// ── BulkActionBar ────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedIds: string[];
  availableStages: WorkflowStage[];
  onClear: () => void;
  onMoveStage: (ids: string[], stageId: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
}

function BulkActionBar({ selectedIds, availableStages, onClear, onMoveStage, onDelete }: BulkActionBarProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetStageId, setTargetStageId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  if (selectedIds.length === 0) return null;

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar ${selectedIds.length} tarea(s)?`)) return;
    setBusy(true);
    try {
      await onDelete(selectedIds);
      onClear();
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmMove() {
    if (!targetStageId) return;
    setBusy(true);
    try {
      await onMoveStage(selectedIds, targetStageId);
      setShowMoveDialog(false);
      setTargetStageId('');
      onClear();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.bulkActionBar} data-testid="bulk-action-bar">
        <span className={styles.bulkCount}>
          ✓ {selectedIds.length} tarea{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className={styles.bulkMoveBtn}
          onClick={() => setShowMoveDialog(true)}
          disabled={busy || availableStages.length === 0}
          aria-label="Mover estado"
        >
          Mover estado
        </button>
        <button type="button" className={styles.bulkDeleteBtn} onClick={handleDelete} disabled={busy}>
          Eliminar
        </button>
        <button type="button" className={styles.bulkClearBtn} onClick={onClear} disabled={busy}>
          ✕ Limpiar
        </button>
      </div>

      {showMoveDialog && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="move-stage-title">
          <div className={styles.dialog}>
            <h2 id="move-stage-title" className={styles.dialogTitle}>
              Mover {selectedIds.length} tarea{selectedIds.length !== 1 ? 's' : ''} a otro estado
            </h2>
            <label className={styles.dialogLabel}>
              Nuevo estado
              <select
                value={targetStageId}
                onChange={e => setTargetStageId(e.target.value)}
                className={styles.dialogSelect}
                autoFocus
              >
                <option value="">Seleccionar…</option>
                {availableStages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setShowMoveDialog(false); setTargetStageId(''); }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleConfirmMove}
                disabled={busy || !targetStageId}
              >
                {busy ? 'Moviendo…' : 'Mover'}
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
  /** Column keys that should be rendered. When undefined, all columns are shown. */
  visibleColumnKeys?: string[];
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
  { key: 'priority',       label: 'Prioridad' },
  { key: 'createdAt',      label: 'Fecha creación' },
  { key: 'updatedAt',      label: 'Fecha actualización' },
];

const PAGE_SIZES = [10, 25, 50, 100];

export function TasksTableView({ tasks, loading = false, availableStages = [], projects = [], workflows = [], priorities = [], visibleColumnKeys }: TasksTableViewProps) {
  const navigate = useNavigate();
  const moveToStage = useMoveTaskToStage();
  const deleteTask = useDeleteTask();
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

  // priority name → colour, from the editable catalog.
  const priorityColor = useMemo(
    () => new Map(priorities.map(p => [p.name, p.color])),
    [priorities],
  );

  const ALL_COLUMNS = [
    { label: '#',         key: 'sequenceNumber', sortable: true,
      render: (t: ScheduledTask) => (
        <Link to={`/admin/scheduling/tasks/${t.id}`} className={styles.idLink}>
          #{t.sequenceNumber}
        </Link>
      ) },
    { label: 'Título',    key: 'title',          sortable: true,
      render: (t: ScheduledTask) => (
        <Link to={`/admin/scheduling/tasks/${t.id}`} className={styles.titleLink} title={t.title}>
          {t.title}
        </Link>
      ) },
    { label: 'Estado',    key: 'stageCategory',  sortable: false,
      render: (t: ScheduledTask) => (
        <StageSelect
          task={t}
          stages={stagesForTask(t)}
          onMove={stageId => moveToStage.mutateAsync({ id: t.id, stageId })}
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
      render: (t: ScheduledTask) => t.startDate ? new Date(t.startDate).toLocaleDateString('es-AR') : '—' },
    { label: 'Asignado',  key: 'assigneeName',   sortable: true },
    { label: 'Prioridad', key: 'priority',       sortable: true,
      render: (t: ScheduledTask) => <PriorityPill priority={t.priority} color={priorityColor.get(t.priority)} /> },
    { label: 'Fecha creación',      key: 'createdAt', sortable: true,
      render: (t: ScheduledTask) => new Date(t.createdAt).toLocaleDateString('es-AR') },
    { label: 'Fecha actualización', key: 'updatedAt', sortable: true,
      render: (t: ScheduledTask) => new Date(t.updatedAt).toLocaleDateString('es-AR') },
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
      <DataTable
        columns={COLUMNS}
        data={pageData}
        loading={loading}
        actions={ACTIONS}
        selectable
        onSelectionChange={setSelectedIds}
        emptyMessage="No hay tareas para mostrar."
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

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        availableStages={availableStages}
        onClear={() => setSelectedIds([])}
        onMoveStage={async (ids, stageId) => {
          // Fan out: one mutation per task. Sequential to keep UI consistent
          // and avoid hammering the server. Each call invalidates the task
          // list cache so the table refreshes when done.
          for (const id of ids) {
            await moveToStage.mutateAsync({ id, stageId });
          }
        }}
        onDelete={async (ids) => {
          for (const id of ids) {
            await deleteTask.mutateAsync(id);
          }
        }}
      />
    </div>
  );
}
