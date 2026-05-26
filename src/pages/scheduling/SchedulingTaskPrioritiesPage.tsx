import { useState } from 'react';
import {
  useTaskPriorities,
  useCreateTaskPriority,
  useUpdateTaskPriority,
  useDeleteTaskPriority,
} from '@/hooks/useTaskPriorities';
import type { TaskPriority } from '@/types/taskPriority';
import styles from './SchedulingTaskCategoriesPage.module.css';

interface ModalProps {
  initial?: TaskPriority;
  nextWeight: number;
  onClose: () => void;
  onSave: (data: { name: string; color: string; weight: number }) => Promise<void>;
  loading: boolean;
}

function PriorityModal({ initial, nextWeight, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#3b82f6');
  const [weight, setWeight] = useState(initial?.weight ?? nextWeight);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), color, weight: Number(weight) });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TASK_PRIORITY_NAME_CONFLICT') {
        setError('Ya existe una prioridad con ese nombre.');
      } else {
        setError('No se pudo guardar la prioridad.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{initial ? 'Editar prioridad' : 'Nueva prioridad'}</h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Crítica" autoFocus />
        </label>
        <label className={styles.label}>
          Color
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 56, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }} />
        </label>
        <label className={styles.label}>
          Peso (orden — mayor = más urgente)
          <input className={styles.input} type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!name.trim() || loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulingTaskPrioritiesPage() {
  const { data: priorities = [], isLoading } = useTaskPriorities();
  const createMutation = useCreateTaskPriority();
  const updateMutation = useUpdateTaskPriority();
  const deleteMutation = useDeleteTaskPriority();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaskPriority | null>(null);

  const nextWeight = priorities.reduce((max, p) => Math.max(max, p.weight), 0) + 1;

  async function handleCreate(data: { name: string; color: string; weight: number }) {
    await createMutation.mutateAsync(data);
  }
  async function handleEdit(data: { name: string; color: string; weight: number }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }
  async function handleDelete(p: TaskPriority) {
    if (!window.confirm(`¿Eliminar la prioridad "${p.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(p.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TASK_PRIORITY_IN_USE') {
        window.alert('No se puede eliminar: hay tareas que usan esta prioridad.');
      } else {
        window.alert('No se pudo eliminar la prioridad.');
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Prioridades</h1>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nueva prioridad</button>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : priorities.length === 0 ? (
          <p className={styles.empty}>No hay prioridades. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Color</th><th>Nombre</th><th>Peso</th><th></th></tr>
            </thead>
            <tbody>
              {priorities.map(p => (
                <tr key={p.id}>
                  <td><span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 9999, background: p.color, border: '1px solid #00000022' }} /></td>
                  <td>{p.name}</td>
                  <td className={styles.desc}>{p.weight}</td>
                  <td className={styles.actions}>
                    <button className={styles.linkBtn} onClick={() => setEditing(p)}>Editar</button>
                    <button className={styles.linkDanger} onClick={() => handleDelete(p)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <PriorityModal nextWeight={nextWeight} onClose={() => setShowCreate(false)} onSave={handleCreate} loading={createMutation.isPending} />
      )}
      {editing && (
        <PriorityModal initial={editing} nextWeight={nextWeight} onClose={() => setEditing(null)} onSave={handleEdit} loading={updateMutation.isPending} />
      )}
    </div>
  );
}
