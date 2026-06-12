import { useState } from 'react';
import {
  useTicketAreas,
  useCreateTicketArea,
  useUpdateTicketArea,
  useDeleteTicketArea,
} from '@/hooks/useTicketAreas';
import type { TicketArea } from '@/types/ticketArea';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './TicketAreasBody.module.css';

interface ModalProps {
  initial?: TicketArea;
  onClose: () => void;
  onSave: (data: { name: string }) => Promise<void>;
  loading: boolean;
}

function TicketAreaModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim() });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_AREA_NAME_CONFLICT') {
        setError('Ya existe un area con ese nombre.');
      } else {
        setError('No se pudo guardar el area.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar area' : 'Nueva area'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Soporte tecnico"
            autoFocus
          />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!name.trim() || loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Areas de tickets: toolbar + tabla + modales, sin header de pagina. */
export function TicketAreasBody() {
  const { data: areas = [], isLoading } = useTicketAreas();
  const createMutation = useCreateTicketArea();
  const updateMutation = useUpdateTicketArea();
  const deleteMutation = useDeleteTicketArea();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TicketArea | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { name: string }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(area: TicketArea) {
    if (!(await confirm({ message: `Eliminar el area "${area.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(area.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_AREA_IN_USE') {
        window.alert('No se puede eliminar: hay tickets que usan esta area.');
      } else {
        window.alert('No se pudo eliminar el area.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="tickets.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nueva area</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando...</p>
        ) : areas.length === 0 ? (
          <p className={styles.empty}>No hay areas. Crea la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {areas.map(area => (
                <tr key={area.id}>
                  <td>{area.name}</td>
                  <td className={styles.actions}>
                    <Can permission="tickets.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(area)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(area)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <TicketAreaModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <TicketAreaModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
