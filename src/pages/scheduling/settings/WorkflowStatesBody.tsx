import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useWorkflows,
  useCreateStage,
  useUpdateStage,
  useUpdateStageColor,
  useReorderStages,
  useDeleteStage,
} from '@/hooks/useWorkflows';
import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import type { WorkflowStage } from '@/types/workflow';
import type { TaskStageCategory } from '@/types/scheduling';
import styles from './WorkflowStatesBody.module.css';

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: TaskStageCategory; label: string }[] = [
  { value: 'nuevo',       label: 'Nuevo' },
  { value: 'enProgreso',  label: 'En progreso' },
  { value: 'hecho',       label: 'Hecho' },
];

const CATEGORY_LABEL: Record<string, string> = {
  nuevo:       'Nuevo',
  enProgreso:  'En progreso',
  hecho:       'Hecho',
  cancelado:   'Cancelado',
};

const CATEGORY_FALLBACK_COLOR: Record<string, string> = {
  nuevo:      '#3b82f6',
  enProgreso: '#f59e0b',
  hecho:      '#22c55e',
  cancelado:  '#ef4444',
};

// ── Pill ───────────────────────────────────────────────────────────────────

function CategoryPill({ category }: { category: string }) {
  const cls =
    category === 'nuevo'      ? styles.pillNuevo
    : category === 'enProgreso' ? styles.pillEnProgreso
    : category === 'hecho'      ? styles.pillHecho
    : styles.pillCancelado;

  return (
    <span className={`${styles.pill} ${cls}`}>
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────

interface CreateModalProps {
  workflowId: string;
  nextOrder: number;
  onClose: () => void;
}

function CreateModal({ workflowId, nextOrder, onClose }: CreateModalProps) {
  const [name, setName]         = useState('');
  const [category, setCategory] = useState<TaskStageCategory>('nuevo');
  const [error, setError]       = useState<string | null>(null);
  const createStage = useCreateStage();

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await createStage.mutateAsync({
        workflowId,
        data: { name: name.trim(), category, order: nextOrder },
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'STAGE_NAME_CONFLICT') {
        setError('Ya existe un estado con ese nombre.');
      } else {
        setError('No se pudo crear el estado.');
      }
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Nuevo estado">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nuevo estado</h2>
        </div>
        <div className={styles.modalBody}>
          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.label}>
            Nombre *
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: En revisión"
              autoFocus
            />
          </label>

          <label className={styles.label}>
            Categoría *
            <select
              className={styles.select}
              value={category}
              onChange={e => setCategory(e.target.value as TaskStageCategory)}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <div className={styles.modalActions}>
            <button
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={createStage.isPending}
            >
              Cancelar
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={!name.trim() || createStage.isPending}
            >
              {createStage.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────

interface EditModalProps {
  workflowId: string;
  stage: WorkflowStage;
  onClose: () => void;
}

function EditModal({ workflowId, stage, onClose }: EditModalProps) {
  const [name, setName]         = useState(stage.name);
  const [category, setCategory] = useState<TaskStageCategory>(stage.category);
  const [color, setColor]       = useState(stage.color ?? CATEGORY_FALLBACK_COLOR[stage.category] ?? '#6366f1');
  const [error, setError]       = useState<string | null>(null);

  const updateStage = useUpdateStage();
  const updateColor = useUpdateStageColor();

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await updateStage.mutateAsync({
        workflowId,
        stageId: stage.id,
        data: { name: name.trim(), category },
      });
      // Only patch color if it changed
      if (color !== (stage.color ?? CATEGORY_FALLBACK_COLOR[stage.category] ?? '#6366f1')) {
        await updateColor.mutateAsync({ workflowId, stageId: stage.id, color });
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'STAGE_NAME_CONFLICT') {
        setError('Ya existe un estado con ese nombre.');
      } else {
        setError('No se pudo guardar el estado.');
      }
    }
  }

  const isPending = updateStage.isPending || updateColor.isPending;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Editar estado">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar estado</h2>
        </div>
        <div className={styles.modalBody}>
          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.label}>
            Nombre *
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </label>

          <label className={styles.label}>
            Categoría
            <select
              className={styles.select}
              value={category}
              onChange={e => setCategory(e.target.value as TaskStageCategory)}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Color
            <div className={styles.colorRow}>
              <input
                type="color"
                className={styles.colorPicker}
                value={color}
                onChange={e => setColor(e.target.value)}
                aria-label={`Color de ${stage.name}`}
              />
              <span
                className={styles.swatch}
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            </div>
          </label>

          <label className={styles.label}>
            Código (solo lectura)
            <span className={styles.codeBadge} aria-label="Código inmutable del estado">{stage.code}</span>
            <span className={styles.readonlyNote}>El código es inmutable. Podés renombrar el estado con total seguridad.</span>
          </label>

          <div className={styles.modalActions}>
            <button
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={!name.trim() || isPending}
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  workflowId: string;
  stage: WorkflowStage;
  isFirst: boolean;
  isLast: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StageRow({
  stage,
  isFirst,
  isLast,
  canManage,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: RowProps) {
  const swatchColor = stage.color ?? CATEGORY_FALLBACK_COLOR[stage.category] ?? '#94a3b8';

  return (
    <tr>
      <td className={styles.orderCell}>
        {canManage && (
          <>
            <button
              className={styles.iconBtn}
              onClick={onMoveUp}
              disabled={isFirst}
              title="Mover arriba"
              aria-label="Mover arriba"
            >
              ▲
            </button>
            <button
              className={styles.iconBtn}
              onClick={onMoveDown}
              disabled={isLast}
              title="Mover abajo"
              aria-label="Mover abajo"
            >
              ▼
            </button>
          </>
        )}
      </td>
      <td className={styles.nameCell}>{stage.name}</td>
      <td>
        <span className={styles.codeBadge}>{stage.code}</span>
      </td>
      <td>
        <div className={styles.colorCell}>
          <span
            className={styles.swatch}
            style={{ backgroundColor: swatchColor }}
            aria-label={`Color: ${swatchColor}`}
          />
        </div>
      </td>
      <td>
        <CategoryPill category={stage.category} />
      </td>
      {canManage && (
        <td className={styles.actionsCell}>
          <button className={styles.linkBtn} onClick={onEdit}>Editar</button>
          <button className={styles.linkDanger} onClick={onDelete}>Eliminar</button>
        </td>
      )}
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/** Estados de workflows — CRUD completo con reordenar, absorbe StageColorsBody. */
export function WorkflowStatesBody() {
  const { data: workflows = [], isLoading, isError } = useWorkflows();
  const canManage = useCan('scheduling.manage');
  const confirm   = useConfirm();
  const reorder   = useReorderStages();
  const delStage  = useDeleteStage();

  const [showCreate, setShowCreate] = useState<string | null>(null); // workflowId
  const [editing, setEditing]       = useState<{ workflowId: string; stage: WorkflowStage } | null>(null);

  async function handleDelete(workflowId: string, stage: WorkflowStage) {
    const ok = await confirm({
      message: `¿Eliminar el estado "${stage.name}"? Esta acción no se puede deshacer.`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await delStage.mutateAsync({ workflowId, stageId: stage.id });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'STAGE_IN_USE') {
        window.alert('No se puede eliminar: hay tareas que usan este estado.');
      } else {
        window.alert('No se pudo eliminar el estado.');
      }
    }
  }

  async function handleMove(workflowId: string, stages: WorkflowStage[], fromIndex: number, direction: 'up' | 'down') {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= sorted.length) return;
    // Swap
    [sorted[fromIndex], sorted[toIndex]] = [sorted[toIndex], sorted[fromIndex]];
    const order = sorted.map(s => s.id);
    await reorder.mutateAsync({ workflowId, order });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <p className={styles.empty}>Cargando estados…</p>;
  }

  if (isError) {
    return <p className={styles.empty}>No se pudieron cargar los estados. Intentá de nuevo.</p>;
  }

  return (
    <div className={styles.root}>
      {workflows.map(wf => {
        const sorted = [...wf.stages].sort((a, b) => a.order - b.order);

        return (
          <div key={wf.id} className={styles.workflowSection}>
            {workflows.length > 1 && (
              <p className={styles.workflowName}>{wf.name}</p>
            )}

            {canManage && (
              <div className={styles.toolbar}>
                <button
                  className={styles.btnPrimary}
                  onClick={() => setShowCreate(wf.id)}
                >
                  + Nuevo estado
                </button>
              </div>
            )}

            <div className={styles.card}>
              {sorted.length === 0 ? (
                <p className={styles.empty}>No hay estados. Creá el primero.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th aria-label="Orden" style={{ width: 72 }}></th>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Color</th>
                      <th>Categoría</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((stage, idx) => (
                      <StageRow
                        key={stage.id}
                        workflowId={wf.id}
                        stage={stage}
                        isFirst={idx === 0}
                        isLast={idx === sorted.length - 1}
                        canManage={canManage}
                        onEdit={() => setEditing({ workflowId: wf.id, stage })}
                        onDelete={() => void handleDelete(wf.id, stage)}
                        onMoveUp={() => void handleMove(wf.id, sorted, idx, 'up')}
                        onMoveDown={() => void handleMove(wf.id, sorted, idx, 'down')}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {showCreate === wf.id && (
              <CreateModal
                workflowId={wf.id}
                nextOrder={sorted.length}
                onClose={() => setShowCreate(null)}
              />
            )}
          </div>
        );
      })}

      {editing && (
        <EditModal
          workflowId={editing.workflowId}
          stage={editing.stage}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
