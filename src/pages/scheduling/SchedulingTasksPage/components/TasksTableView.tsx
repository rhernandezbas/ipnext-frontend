import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { ScheduledTask, TaskStageCategory } from '@/types/scheduling';
import type { Workflow, WorkflowStage } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { TaskPriority } from '@/types/taskPriority';
import { useMoveTaskToStage, useDeleteTask, useCloseTask, useSetTaskInventoryReview } from '@/hooks/useScheduling';
import { useAuth } from '@/hooks/useAuth';
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

/** Clickable indicator for the RV (Revisado por Inventario) column. */
function RvIndicator({
  taskId,
  reviewed,
  onToggle,
}: {
  taskId: string;
  reviewed: boolean;
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

// Fallback colour per category when a stage has no custom colour set.
const CATEGORY_COLOR: Record<TaskStageCategory, string> = {
  nuevo:      '#3b82f6',
  enProgreso: '#f59e0b',
  hecho:      '#22c55e',
  cancelado:  '#ef4444',
};
function stageColor(s: WorkflowStage): string {
  return s.color || CATEGORY_COLOR[s.category] || '#6b7280';
}

/**
 * Inline editable estado. A custom colour-coded dropdown (native <option>s can't
 * show background colours): the trigger is a pill tinted with the current stage's
 * colour, and the popover lists every stage with its own colour swatch so you can
 * see which colour each estado is when choosing. Moves the task without opening it.
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
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = stages.find(s => s.id === task.stageId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // Close on scroll/resize since the fixed-position menu would otherwise float away.
    // But ignore scroll events originating INSIDE the menu — otherwise scrolling
    // the options list closes it before the user can pick anything.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // No workflow stages resolved → fall back to the read-only category badge.
  if (stages.length === 0) return <StageBadge stageCategory={task.stageCategory} />;

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      // Open upward if there isn't room below (menu max-height ~280).
      const below = window.innerHeight - r.bottom;
      const top = below < 290 && r.top > 290 ? r.top - Math.min(280, r.top - 8) : r.bottom + 4;
      setPos({ top, left: r.left });
    }
    setOpen(true);
  }

  async function pick(stageId: string) {
    setOpen(false);
    if (stageId === task.stageId) return;
    setBusy(true);
    try {
      await onMove(stageId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stagePicker} onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.stagePickerBtn}
        style={{ backgroundColor: current ? stageColor(current) : '#6b7280' }}
        disabled={busy}
        onClick={toggle}
        aria-label="Cambiar estado"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.name ?? '—'} <span className={styles.caret}>▾</span>
      </button>
      {open && pos && createPortal(
        <ul
          ref={menuRef}
          className={styles.stageMenu}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          role="listbox"
          onClick={e => e.stopPropagation()}
        >
          {stages.map(s => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === task.stageId}
                className={styles.stageOption}
                onClick={() => pick(s.id)}
              >
                <span className={styles.swatch} style={{ backgroundColor: stageColor(s) }} />
                {s.name}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

// ── BulkActionBar ────────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedIds: string[];
  availableStages: WorkflowStage[];
  onClear: () => void;
  onMoveStage: (ids: string[], stageId: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  onClose: (ids: string[]) => Promise<void>;
  isAdmin: boolean;
}

function BulkActionBar({ selectedIds, availableStages, onClear, onMoveStage, onDelete, onClose, isAdmin }: BulkActionBarProps) {
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

  async function handleClose() {
    if (!window.confirm(`¿Cerrar ${selectedIds.length} tarea(s)?`)) return;
    setBusy(true);
    try {
      await onClose(selectedIds);
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
        <span className={styles.bulkLabel}>Acciones masivas</span>
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
        <button
          type="button"
          className={styles.bulkCloseBtn}
          onClick={() => void handleClose()}
          disabled={busy}
          data-testid="bulk-close-btn"
        >
          Cerrar
        </button>
        {isAdmin && (
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
  { key: 'createdAt',             label: 'Fecha creación' },
  { key: 'updatedAt',             label: 'Fecha actualización' },
  { key: 'reviewedByInventory',   label: 'RV' },
];

const PAGE_SIZES = [10, 25, 50, 100];

export function TasksTableView({ tasks, loading = false, availableStages = [], projects = [], workflows = [], priorities = [], visibleColumnKeys }: TasksTableViewProps) {
  const navigate = useNavigate();
  const moveToStage = useMoveTaskToStage();
  const deleteTask = useDeleteTask();
  const closeTask = useCloseTask();
  const setInventoryReview = useSetTaskInventoryReview();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
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
        <span className={t.isClosed ? styles.closedRow : undefined}>
          <Link to={`/admin/scheduling/tasks/${t.id}`} className={styles.titleLink} title={t.title}>
            {t.title}
          </Link>
          {t.isClosed && (
            <span className={styles.closedBadge} data-testid="closed-badge" aria-label="Tarea cerrada">
              Cerrada
            </span>
          )}
        </span>
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
    { label: 'RV', key: 'reviewedByInventory', sortable: false,
      render: (t: ScheduledTask) => (
        <RvIndicator
          taskId={t.id}
          reviewed={t.reviewedByInventory}
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
      {/* Bulk action bar — inline panel, shown above the table when rows are selected */}
      <BulkActionBar
        selectedIds={selectedIds}
        availableStages={availableStages}
        onClear={() => setSelectedIds([])}
        onMoveStage={async (ids, stageId) => {
          for (const id of ids) {
            await moveToStage.mutateAsync({ id, stageId });
          }
        }}
        onClose={async (ids) => {
          for (const id of ids) {
            await closeTask.mutateAsync({ id, isClosed: true });
          }
        }}
        onDelete={async (ids) => {
          for (const id of ids) {
            await deleteTask.mutateAsync(id);
          }
        }}
        isAdmin={isAdmin}
      />
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

    </div>
  );
}
