import { useState } from 'react';
import {
  useTicketStatuses,
  useCreateTicketStatus,
  useUpdateTicketStatus,
  useDeleteTicketStatus,
} from '@/hooks/useTicketStatuses';
import type { TicketStatus } from '@/types/ticketStatus';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './TicketAreasBody.module.css';

interface ModalProps {
  initial?: TicketStatus;
  nextWeight: number;
  onClose: () => void;
  onSave: (data: { name: string; color: string; weight: number }) => Promise<void>;
  loading: boolean;
}

function StatusModal({ initial, nextWeight, onClose, onSave, loading }: ModalProps) {
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
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_STATUS_NAME_CONFLICT') {
        setError('Ya existe un estado con ese nombre.');
      } else {
        setError('No se pudo guardar el estado.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{initial ? 'Editar estado' : 'Nuevo estado'}</h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Resuelto"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Color
          <input
            type="color"
            aria-label="Color del estado"
            value={color}
            onChange={e => setColor(e.target.value)}
            style={{ width: 56, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}
          />
        </label>
        <label className={styles.label}>
          Peso (orden — mayor = más urgente)
          <input
            className={styles.input}
            type="number"
            value={weight}
            onChange={e => setWeight(Number(e.target.value))}
          />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
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

/** Estados de tickets: toolbar + tabla + modales, sin header de página. */
export function TicketStatusesBody() {
  const { data: statuses = [], isLoading } = useTicketStatuses();
  const createMutation = useCreateTicketStatus();
  const updateMutation = useUpdateTicketStatus();
  const deleteMutation = useDeleteTicketStatus();
  const confirm = useConfirm();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TicketStatus | null>(null);

  const nextWeight = statuses.reduce((max, s) => Math.max(max, s.weight), 0) + 1;

  async function handleCreate(data: { name: string; color: string; weight: number }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; color: string; weight: number }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(s: TicketStatus) {
    if (!(await confirm({ message: `¿Eliminar el estado "${s.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(s.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_STATUS_IN_USE') {
        window.alert('No se puede eliminar: hay tickets que usan este estado.');
      } else {
        window.alert('No se pudo eliminar el estado.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="tickets.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nuevo estado</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : statuses.length === 0 ? (
          <p className={styles.empty}>No hay estados. Creá el primero.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Color</th>
                <th>Nombre</th>
                <th>Peso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statuses.map(s => (
                <tr key={s.id}>
                  <td>
                    <span
                      aria-label={`Color de ${s.name}`}
                      style={{
                        display: 'inline-block',
                        width: 18,
                        height: 18,
                        borderRadius: 9999,
                        background: s.color,
                        border: '1px solid #00000022',
                        verticalAlign: 'middle',
                      }}
                    />
                  </td>
                  <td>{s.name}</td>
                  <td>{s.weight}</td>
                  <td className={styles.actions}>
                    <Can permission="tickets.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(s)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(s)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <StatusModal
          nextWeight={nextWeight}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <StatusModal
          initial={editing}
          nextWeight={nextWeight}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
