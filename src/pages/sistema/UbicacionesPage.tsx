import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import {
  useUbicaciones,
  useCreateUbicacion,
  useUpdateUbicacion,
  useDeleteUbicacion,
} from '@/hooks/useUbicaciones';
import type { Ubicacion } from '@/types/ubicacion';
import styles from './UbicacionesPage.module.css';

function StatusBadge({ status }: { status: Ubicacion['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

interface UbicacionFormProps {
  initial?: Partial<Ubicacion>;
  onClose: () => void;
  onSubmit: (data: Omit<Ubicacion, 'id'>) => void;
  title: string;
}

function UbicacionFormModal({ initial = {}, onClose, onSubmit, title }: UbicacionFormProps) {
  const [name, setName] = useState(initial.name ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [state, setState] = useState(initial.state ?? '');
  const [country, setCountry] = useState(initial.country ?? 'Argentina');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [manager, setManager] = useState(initial.manager ?? '');
  const [timezone, setTimezone] = useState(initial.timezone ?? 'America/Argentina/Buenos_Aires');
  const [status, setStatus] = useState<Ubicacion['status']>(initial.status ?? 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      address,
      city,
      state,
      country,
      phone,
      email,
      manager,
      timezone,
      status,
      clientCount: initial.clientCount ?? 0,
      coordinates: initial.coordinates ?? null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="ub-name">Nombre</label>
            <input id="ub-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="ub-address">Dirección</label>
            <input id="ub-address" type="text" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ub-city">Ciudad</label>
              <input id="ub-city" type="text" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ub-state">Provincia</label>
              <input id="ub-state" type="text" value={state} onChange={e => setState(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ub-country">País</label>
              <input id="ub-country" type="text" value={country} onChange={e => setCountry(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ub-phone">Teléfono</label>
              <input id="ub-phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ub-email">Email</label>
              <input id="ub-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ub-manager">Gestor</label>
              <input id="ub-manager" type="text" value={manager} onChange={e => setManager(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ub-timezone">Zona horaria</label>
              <input id="ub-timezone" type="text" value={timezone} onChange={e => setTimezone(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ub-status">Estado</label>
              <select id="ub-status" value={status} onChange={e => setStatus(e.target.value as Ubicacion['status'])}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UbicacionesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null);
  const [ubicSearch, setUbicSearch] = useState('');
  const [ubicStatus, setUbicStatus] = useState('');

  const { data: ubicaciones = [], isLoading } = useUbicaciones();
  const { mutate: createUbicacion } = useCreateUbicacion();
  const { mutate: updateUbicacion } = useUpdateUbicacion();
  const { mutate: deleteUbicacion } = useDeleteUbicacion();

  const activeCount = ubicaciones.filter(u => u.status === 'active').length;
  const inactiveCount = ubicaciones.filter(u => u.status === 'inactive').length;
  const totalClients = ubicaciones.reduce((sum, u) => sum + u.clientCount, 0);

  const filteredUbicaciones = ubicaciones.filter(u => {
    const q = ubicSearch.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q);
    const matchesStatus = !ubicStatus || u.status === ubicStatus;
    return matchesSearch && matchesStatus;
  });

  const ubicacionMap = new Map(ubicaciones.map(u => [u.id, u.name]));

  function handleCreate(data: Omit<Ubicacion, 'id'>) {
    createUbicacion(data);
    setShowModal(false);
  }

  const columns = [
    {
      label: 'Nombre',
      key: 'name' as keyof Ubicacion,
      render: (row: Ubicacion) => {
        if (row.parentId) {
          const parentName = ubicacionMap.get(row.parentId);
          return parentName ? `${parentName} > ${row.name}` : row.name;
        }
        return row.name;
      },
    },
    { label: 'Ciudad', key: 'city' as keyof Ubicacion },
    { label: 'Provincia', key: 'state' as keyof Ubicacion },
    { label: 'País', key: 'country' as keyof Ubicacion },
    { label: 'Gestor', key: 'manager' as keyof Ubicacion },
    { label: 'Clientes', key: 'clientCount' as keyof Ubicacion },
    { label: 'Zona horaria', key: 'timezone' as keyof Ubicacion },
    {
      label: 'Ubicación padre',
      key: 'parentId' as keyof Ubicacion,
      render: (row: Ubicacion) => row.parentId ? (ubicacionMap.get(row.parentId) ?? '—') : '—',
    },
    {
      label: 'Estado',
      key: 'status' as keyof Ubicacion,
      render: (row: Ubicacion) => <StatusBadge status={row.status} />,
    },
  ];

  const actions = [
    { label: 'Editar', onClick: (row: Ubicacion) => setEditingUbicacion(row) },
    {
      label: 'Ver en mapa',
      onClick: (row: Ubicacion) => {
        const q = encodeURIComponent(`${row.address}, ${row.city}, ${row.country}`);
        window.open(`https://maps.google.com/?q=${q}`, '_blank');
      },
    },
    {
      label: 'Desactivar',
      onClick: (row: Ubicacion) => {
        updateUbicacion({ id: row.id, data: { status: 'inactive' } });
      },
    },
    {
      label: 'Eliminar',
      onClick: (row: Ubicacion) => deleteUbicacion(row.id),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Ubicaciones</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Nueva ubicación
        </button>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid} aria-label="Summary cards">
        <div className={styles.summaryCard}>
          <p className={styles.summaryValue}>{ubicaciones.length}</p>
          <p className={styles.summaryLabel}>Total ubicaciones</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryValue}>{activeCount}</p>
          <p className={styles.summaryLabel}>Activas</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryValue}>{inactiveCount}</p>
          <p className={styles.summaryLabel}>Inactivas</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryValue}>{totalClients.toLocaleString('es-AR')}</p>
          <p className={styles.summaryLabel}>Total clientes</p>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Buscar por nombre o ciudad..."
        onSearch={setUbicSearch}
        filters={[{
          key: 'status',
          label: 'Estado',
          options: [
            { value: '', label: 'Todos' },
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
          ],
        }]}
        onFilterChange={(_key, value) => setUbicStatus(value)}
      />
      <DataTable
        columns={columns}
        data={filteredUbicaciones}
        loading={isLoading}
        actions={actions}
        emptyMessage="No hay ubicaciones registradas."
      />

      {showModal && (
        <UbicacionFormModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          title="Nueva ubicación"
        />
      )}

      {editingUbicacion && (
        <UbicacionFormModal
          initial={editingUbicacion}
          onClose={() => setEditingUbicacion(null)}
          onSubmit={data => { updateUbicacion({ id: editingUbicacion.id, data }); setEditingUbicacion(null); }}
          title="Editar ubicación"
        />
      )}
    </div>
  );
}
