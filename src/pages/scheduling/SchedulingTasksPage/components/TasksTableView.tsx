import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { ScheduledTask, TaskPriority, TaskStageCategory } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import { useMoveTaskToStage, useDeleteTask } from '@/hooks/useScheduling';
import styles from './TasksTableView.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} día${days !== 1 ? 's' : ''}`;
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'Baja',
  normal: 'Normal',
  high:   'Alta',
  urgent: 'Urgente',
};

const CATEGORY_LABEL: Record<TaskStageCategory, string> = {
  nuevo:      'Nuevo',
  enProgreso: 'En progreso',
  hecho:      'Hecho',
  cancelado:  'Cancelado',
};

// ── Atoms ────────────────────────────────────────────────────────────────────

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={styles.priorityPill}
      data-priority={priority}
      aria-label={`Prioridad: ${PRIORITY_LABELS[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
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
          aria-label="Mover etapa"
        >
          Mover etapa
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
              Mover {selectedIds.length} tarea{selectedIds.length !== 1 ? 's' : ''} a otra etapa
            </h2>
            <label className={styles.dialogLabel}>
              Nueva etapa
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
  /** Stages available for the bulk "Mover etapa" action (typically the workflow of the selected project) */
  availableStages?: WorkflowStage[];
}

const PAGE_SIZES = [10, 25, 50, 100];

export function TasksTableView({ tasks, loading = false, availableStages = [] }: TasksTableViewProps) {
  const navigate = useNavigate();
  const moveToStage = useMoveTaskToStage();
  const deleteTask = useDeleteTask();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.ceil(tasks.length / pageSize);
  const pageData = tasks.slice((page - 1) * pageSize, page * pageSize);

  const COLUMNS = [
    { label: '#',         key: 'sequenceNumber', sortable: true },
    { label: 'Etapa',     key: 'stageCategory',  sortable: false,
      render: (t: ScheduledTask) => <StageBadge stageCategory={t.stageCategory} /> },
    { label: 'Proyecto',  key: 'projectName',    sortable: true },
    { label: 'Dirección', key: 'address',        sortable: true },
    { label: 'Cliente',   key: 'customerName',   sortable: true },
    { label: 'Inicio',    key: 'startDate',      sortable: true,
      render: (t: ScheduledTask) => t.startDate ? new Date(t.startDate).toLocaleDateString('es-AR') : '—' },
    { label: 'Asignado',  key: 'assigneeName',   sortable: true },
    { label: 'Prioridad', key: 'priority',       sortable: true,
      render: (t: ScheduledTask) => <PriorityPill priority={t.priority} /> },
    { label: 'Edad',      key: 'createdAt',      sortable: true,
      render: (t: ScheduledTask) => formatAge(t.createdAt) },
  ];

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
