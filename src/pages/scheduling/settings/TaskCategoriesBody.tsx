import { useState } from 'react';
import {
  useTaskCategories,
  useCreateTaskCategory,
  useUpdateTaskCategory,
  useDeleteTaskCategory,
} from '@/hooks/useTaskCategories';
import type { TaskCategory } from '@/types/taskCategory';
import styles from '../SchedulingTaskCategoriesPage.module.css';

interface ModalProps {
  initial?: TaskCategory;
  onClose: () => void;
  onSave: (data: { name: string; description: string | null }) => Promise<void>;
  loading: boolean;
}

function CategoryModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TASK_CATEGORY_NAME_CONFLICT') {
        setError('Ya existe una categoría con ese nombre.');
      } else {
        setError('No se pudo guardar la categoría.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{initial ? 'Editar categoría' : 'Nueva categoría'}</h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Relevamiento" autoFocus />
        </label>
        <label className={styles.label}>
          Descripción
          <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Opcional" />
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

/** Categorías de tareas — toolbar + tabla + modales, sin header de página.
 *  Reusado por SchedulingTaskCategoriesPage (standalone) y SchedulingSettingsPage (tab). */
export function TaskCategoriesBody() {
  const { data: categories = [], isLoading } = useTaskCategories();
  const createMutation = useCreateTaskCategory();
  const updateMutation = useUpdateTaskCategory();
  const deleteMutation = useDeleteTaskCategory();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaskCategory | null>(null);

  async function handleCreate(data: { name: string; description: string | null }) {
    await createMutation.mutateAsync(data);
  }
  async function handleEdit(data: { name: string; description: string | null }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }
  async function handleDelete(cat: TaskCategory) {
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(cat.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TASK_CATEGORY_IN_USE') {
        window.alert('No se puede eliminar: hay tareas que usan esta categoría.');
      } else {
        window.alert('No se pudo eliminar la categoría.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nueva categoría</button>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : categories.length === 0 ? (
          <p className={styles.empty}>No hay categorías. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Nombre</th><th>Descripción</th><th></th></tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className={styles.desc}>{c.description || '—'}</td>
                  <td className={styles.actions}>
                    <button className={styles.linkBtn} onClick={() => setEditing(c)}>Editar</button>
                    <button className={styles.linkDanger} onClick={() => handleDelete(c)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CategoryModal onClose={() => setShowCreate(false)} onSave={handleCreate} loading={createMutation.isPending} />
      )}
      {editing && (
        <CategoryModal initial={editing} onClose={() => setEditing(null)} onSave={handleEdit} loading={updateMutation.isPending} />
      )}
    </>
  );
}
