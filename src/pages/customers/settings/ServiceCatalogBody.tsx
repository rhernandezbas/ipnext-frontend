import { useState } from 'react';
import {
  useServiceCatalog,
  useCreateServiceCatalog,
  useUpdateServiceCatalog,
  useDeleteServiceCatalog,
} from '@/hooks/useServiceCatalog';
import type { ServiceCatalogEntry } from '@/types/customer';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './ServiceCatalogBody.module.css';

interface ModalProps {
  initial?: ServiceCatalogEntry;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (data: { name: string; label: string | null; active: boolean; sortOrder: number }) => Promise<void>;
  loading: boolean;
}

function ServiceModal({ initial, nextSortOrder, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextSortOrder);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), label: label.trim() || null, active, sortOrder: Number(sortOrder) });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'SERVICE_CATALOG_NAME_CONFLICT') {
        // Keep the modal open so the operator can fix the name.
        setError('Ya existe un servicio con ese nombre.');
      } else if (e.response?.status === 422 && e.response.data?.code === 'SERVICE_CATALOG_NON_RENAMEABLE') {
        // OTROS is a reserved entry — keep the modal open so the operator can revert.
        setError('El servicio OTROS no se puede renombrar.');
      } else {
        setError('No se pudo guardar el servicio.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar servicio' : 'Nuevo servicio'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: INTERNET"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Etiqueta
          <input
            className={styles.input}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Internet"
          />
        </label>
        <label className={styles.label}>
          Orden
          <input
            className={styles.input}
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(Number(e.target.value))}
          />
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
          />
          <span>Activo</span>
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

/** Maps a delete-mutation error onto a user-facing message (mapError pattern). */
function mapDeleteError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  if (e.response?.status === 422 && e.response.data?.code === 'SERVICE_IN_USE') {
    return 'No se puede eliminar: hay contratos que usan este servicio.';
  }
  if (e.response?.status === 422 && e.response.data?.code === 'SERVICE_CATALOG_NON_DELETABLE') {
    return 'El servicio OTROS no se puede eliminar.';
  }
  return 'No se pudo eliminar el servicio.';
}

/** Catálogo de servicios — toolbar + tabla + modales, sin header de página (#42/#43). */
export function ServiceCatalogBody() {
  const { data: entries = [], isLoading } = useServiceCatalog();
  const createMutation = useCreateServiceCatalog();
  const updateMutation = useUpdateServiceCatalog();
  const deleteMutation = useDeleteServiceCatalog();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalogEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const confirm = useConfirm();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const nextSortOrder = entries.reduce((max, e) => Math.max(max, e.sortOrder), 0) + 1;

  async function handleCreate(data: { name: string; label: string | null; active: boolean; sortOrder: number }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; label: string | null; active: boolean; sortOrder: number }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(entry: ServiceCatalogEntry) {
    if (!(await confirm({ message: `¿Eliminar el servicio "${entry.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(entry.id);
    } catch (err: unknown) {
      showToast(mapDeleteError(err));
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="clients.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nuevo servicio</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : entries.length === 0 ? (
          <p className={styles.empty}>No hay servicios. Creá el primero.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Etiqueta</th>
                <th>Activo</th>
                <th>Orden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.name}</td>
                  <td className={styles.desc}>{entry.label ?? '—'}</td>
                  <td>{entry.active ? 'Sí' : 'No'}</td>
                  <td className={styles.desc}>{entry.sortOrder}</td>
                  <td className={styles.actions}>
                    <Can permission="clients.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(entry)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(entry)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <ServiceModal
          nextSortOrder={nextSortOrder}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <ServiceModal
          initial={editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}

      {toast && (
        <p className={styles.toast} role="alert">
          {toast}
        </p>
      )}
    </>
  );
}

export default ServiceCatalogBody;
