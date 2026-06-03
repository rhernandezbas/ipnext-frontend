import { useState } from 'react';
import {
  useDeviceTypes,
  useCreateDeviceType,
  useUpdateDeviceType,
  useDeleteDeviceType,
} from '@/hooks/useDeviceTypes';
import type { DeviceType } from '@/types/deviceType';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './DeviceTypesBody.module.css';

interface ModalProps {
  initial?: DeviceType;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (data: { name: string; label: string | null; active: boolean; sortOrder: number }) => Promise<void>;
  loading: boolean;
}

function DeviceTypeModal({ initial, nextSortOrder, onClose, onSave, loading }: ModalProps) {
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
      if (e.response?.status === 409 && e.response.data?.code === 'DEVICE_TYPE_NAME_CONFLICT') {
        setError('Ya existe un tipo con ese nombre.');
      } else {
        setError('No se pudo guardar el tipo de equipo.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar tipo de equipo' : 'Nuevo tipo de equipo'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: ANTENA"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Etiqueta
          <input
            className={styles.input}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Antena WiFi"
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

/** Tipos de equipos — toolbar + tabla + modales, sin header de página. */
export function DeviceTypesBody() {
  const { data: deviceTypes = [], isLoading } = useDeviceTypes();
  const createMutation = useCreateDeviceType();
  const updateMutation = useUpdateDeviceType();
  const deleteMutation = useDeleteDeviceType();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<DeviceType | null>(null);
  const confirm = useConfirm();

  const nextSortOrder = deviceTypes.reduce((max, dt) => Math.max(max, dt.sortOrder), 0) + 1;

  async function handleCreate(data: { name: string; label: string | null; active: boolean; sortOrder: number }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; label: string | null; active: boolean; sortOrder: number }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(dt: DeviceType) {
    if (!(await confirm({ message: `¿Eliminar el tipo "${dt.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(dt.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'DEVICE_TYPE_IN_USE') {
        window.alert('No se puede eliminar: hay equipos que usan este tipo.');
      } else if (e.response?.status === 409 && e.response.data?.code === 'DEVICE_TYPE_PROTECTED') {
        window.alert('El tipo OTROS no se puede eliminar.');
      } else {
        window.alert('No se pudo eliminar el tipo de equipo.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="inventory.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nuevo tipo</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : deviceTypes.length === 0 ? (
          <p className={styles.empty}>No hay tipos de equipo. Creá el primero.</p>
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
              {deviceTypes.map(dt => (
                <tr key={dt.id}>
                  <td>{dt.name}</td>
                  <td className={styles.desc}>{dt.label ?? '—'}</td>
                  <td>{dt.active ? 'Sí' : 'No'}</td>
                  <td className={styles.desc}>{dt.sortOrder}</td>
                  <td className={styles.actions}>
                    <Can permission="inventory.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(dt)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(dt)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <DeviceTypeModal
          nextSortOrder={nextSortOrder}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <DeviceTypeModal
          initial={editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
