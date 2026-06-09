import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from '@/hooks/useVehicles';
import type { Vehicle } from '@/types/vehicle';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './MaterialsBody.module.css';

interface VehicleModalProps {
  initial?: Vehicle;
  onClose: () => void;
  onSave: (data: { plate: string; name: string | null }) => Promise<void>;
  loading: boolean;
}

function VehicleModal({ initial, onClose, onSave, loading }: VehicleModalProps) {
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({
        plate: plate.trim().toUpperCase(),
        name: name.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'VEHICLE_PLATE_CONFLICT') {
        setError('Ya existe una camioneta con esa patente.');
      } else {
        setError('No se pudo guardar la camioneta.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar camioneta' : 'Nueva camioneta'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Patente *
          <input
            className={styles.input}
            value={plate}
            onChange={e => setPlate(e.target.value)}
            placeholder="Ej: ABC-123"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Nombre
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Camioneta Norte"
          />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!plate.trim() || loading}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Camionetas ABM — toolbar + tabla + modales, sin header de página. */
export function VehiclesBody() {
  const { data: vehicles = [], isLoading } = useVehicles();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  const deleteMutation = useDeleteVehicle();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { plate: string; name: string | null }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { plate: string; name: string | null }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(vehicle: Vehicle) {
    if (
      !(await confirm({
        message: `¿Eliminar la camioneta "${vehicle.plate}"?`,
        tone: 'danger',
        confirmLabel: 'Eliminar',
      }))
    )
      return;
    try {
      await deleteMutation.mutateAsync(vehicle.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'VEHICLE_IN_USE') {
        window.alert(
          'No se puede eliminar: la camioneta tiene stock o ubicación asociada. Retirá el stock primero.',
        );
      } else {
        window.alert('No se pudo eliminar la camioneta.');
      }
    }
  }

  async function handleToggleStatus(vehicle: Vehicle) {
    const newStatus = vehicle.status === 'active' ? 'inactive' : 'active';
    await updateMutation.mutateAsync({ id: vehicle.id, data: { status: newStatus } });
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="inventory.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + Nueva camioneta
          </button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : vehicles.length === 0 ? (
          <p className={styles.empty}>No hay camionetas. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Patente</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate}</td>
                  <td className={styles.desc}>{vehicle.name ?? '—'}</td>
                  <td>
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td>
                    <Link
                      to={`/admin/inventory/vehicles/${vehicle.id}`}
                      className={styles.linkBtn}
                    >
                      Ver stock
                    </Link>
                  </td>
                  <td className={styles.actions}>
                    <Can permission="inventory.manage">
                      <button
                        className={styles.linkBtn}
                        onClick={() => setEditing(vehicle)}
                      >
                        Editar
                      </button>
                      <button
                        className={styles.linkBtn}
                        onClick={() => handleToggleStatus(vehicle)}
                        title={
                          vehicle.status === 'active'
                            ? 'Desactivar camioneta'
                            : 'Activar camioneta'
                        }
                      >
                        {vehicle.status === 'active' ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        className={styles.linkDanger}
                        onClick={() => handleDelete(vehicle)}
                      >
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
        <VehicleModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <VehicleModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        background: status === 'active' ? 'var(--badge-active-bg, #dcfce7)' : 'var(--color-gray-100, #f1f5f9)',
        color: status === 'active' ? 'var(--badge-active-fg, #15803d)' : 'var(--color-text-secondary, #64748b)',
      }}
    >
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}
