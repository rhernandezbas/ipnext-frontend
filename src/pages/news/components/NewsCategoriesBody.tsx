import { useState } from 'react';
import {
  useNewsCategories,
  useCreateNewsCategory,
  useUpdateNewsCategory,
  useDeleteNewsCategory,
} from '@/hooks/useNews';
import type { NewsCategory } from '@/types/news';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './NewsCategoriesBody.module.css';

const DEFAULT_CATEGORY_COLOR = '#6366f1';

interface ApiErrorLike {
  response?: { status?: number; data?: { code?: string } };
}

interface ModalProps {
  initial?: NewsCategory;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  loading: boolean;
}

function NewsCategoryModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CATEGORY_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
      onClose();
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      if (e.response?.status === 409 && e.response.data?.code === 'NEWS_CATEGORY_NAME_CONFLICT') {
        setError('Ya existe una categoría con ese nombre.');
      } else {
        setError('No se pudo guardar la categoría.');
      }
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="news-category-modal-title">
        <h2 id="news-category-modal-title" className={styles.modalTitle}>
          {initial ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Campañas"
            autoFocus
            maxLength={60}
          />
        </label>
        <label className={styles.label}>
          Color
          <input
            type="color"
            aria-label="Color de la categoría"
            className={styles.colorInput}
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!name.trim() || loading}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * NewsCategoriesBody (internal-news FE apply, NEWS-FE-CAT-1) — categorías del
 * tablón. Calco de `TicketAreasBody.tsx` (toolbar + tabla + modales), con
 * tokens en vez de hex crudo. La sub-page `/admin/news/settings` ya gatea
 * news.manage a nivel ruta; el `<Can>` interno es defense-in-depth, mismo
 * criterio que `TicketAreasBody`.
 */
export function NewsCategoriesBody() {
  const { data: categories = [], isLoading } = useNewsCategories();
  const createMutation = useCreateNewsCategory();
  const updateMutation = useUpdateNewsCategory();
  const deleteMutation = useDeleteNewsCategory();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<NewsCategory | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { name: string; color: string }) {
    setListError(null);
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; color: string }) {
    if (!editing) return;
    setListError(null);
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(category: NewsCategory) {
    if (!(await confirm({ message: `¿Eliminar la categoría "${category.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    setListError(null);
    try {
      await deleteMutation.mutateAsync(category.id);
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      if (e.response?.status === 409 && e.response.data?.code === 'NEWS_CATEGORY_IN_USE') {
        setListError(`"${category.name}" tiene noticias asociadas y no puede borrarse.`);
      } else {
        setListError('No se pudo eliminar la categoría.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="news.manage">
          <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + Nueva categoría
          </button>
        </Can>
      </div>

      {listError && <p role="alert" className={styles.listError}>{listError}</p>}

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : categories.length === 0 ? (
          <p className={styles.empty}>No hay categorías. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Color</th>
                <th>Nombre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <span
                      aria-label={`Color de ${category.name}`}
                      className={styles.swatch}
                      style={{ background: category.color }}
                    />
                  </td>
                  <td>{category.name}</td>
                  <td className={styles.actions}>
                    <Can permission="news.manage">
                      <button type="button" className={styles.linkBtn} onClick={() => setEditing(category)}>
                        Editar
                      </button>
                      <button type="button" className={styles.linkDanger} onClick={() => handleDelete(category)}>
                        Eliminar
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <NewsCategoryModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <NewsCategoryModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
