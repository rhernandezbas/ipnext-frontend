import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner } from '@/hooks/usePartners';
import type { Partner } from '@/types/partner';
import styles from './PartnersPage.module.css';

function StatusBadge({ status }: { status: Partner['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

interface PartnerFormProps {
  initial?: Partial<Partner>;
  onClose: () => void;
  onSubmit: (data: Omit<Partner, 'id' | 'createdAt' | 'clientCount' | 'adminCount'>) => void;
  title: string;
  submitLabel: string;
}

function PartnerFormModal({ initial = {}, onClose, onSubmit, title, submitLabel }: PartnerFormProps) {
  const [name, setName] = useState(initial.name ?? '');
  const [primaryEmail, setPrimaryEmail] = useState(initial.primaryEmail ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [country, setCountry] = useState(initial.country ?? 'AR');
  const [timezone, setTimezone] = useState(initial.timezone ?? 'America/Argentina/Buenos_Aires');
  const [currency, setCurrency] = useState(initial.currency ?? 'ARS');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      primaryEmail,
      phone,
      address,
      city,
      country,
      timezone,
      currency,
      status: initial.status ?? 'active',
      logoUrl: initial.logoUrl ?? null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="partner-name">Nombre</label>
            <input
              id="partner-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="partner-email">Email</label>
            <input
              id="partner-email"
              type="email"
              value={primaryEmail}
              onChange={e => setPrimaryEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="partner-phone">Teléfono</label>
            <input
              id="partner-phone"
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="partner-address">Dirección</label>
            <input
              id="partner-address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="partner-city">Ciudad</label>
              <input
                id="partner-city"
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="partner-country">País</label>
              <input
                id="partner-country"
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="partner-timezone">Zona horaria</label>
              <input
                id="partner-timezone"
                type="text"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="partner-currency">Moneda</label>
              <input
                id="partner-currency"
                type="text"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const columns = [
  { label: 'Nombre', key: 'name' as keyof Partner },
  { label: 'Ciudad', key: 'city' as keyof Partner },
  { label: 'País', key: 'country' as keyof Partner },
  { label: 'Clientes', key: 'clientCount' as keyof Partner },
  { label: 'Admins', key: 'adminCount' as keyof Partner },
  { label: 'Comisión (%)', key: 'comision' as keyof Partner },
  {
    label: 'Estado',
    key: 'status' as keyof Partner,
    render: (row: Partner) => <StatusBadge status={row.status} />,
  },
];

export default function PartnersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [viewPartner, setViewPartner] = useState<Partner | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerStatus, setPartnerStatus] = useState('');

  const { data: partners = [], isLoading } = usePartners();
  const { mutate: createPartner } = useCreatePartner();
  const { mutate: updatePartner } = useUpdatePartner();
  const { mutate: deletePartner } = useDeletePartner();

  function handleCreate(data: Omit<Partner, 'id' | 'createdAt' | 'clientCount' | 'adminCount'>) {
    createPartner(data);
    setShowModal(false);
  }

  const filteredPartners = partners.filter(p => {
    const q = partnerSearch.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q);
    const matchesStatus = !partnerStatus || p.status === partnerStatus;
    return matchesSearch && matchesStatus;
  });

  function handleUpdate(data: Omit<Partner, 'id' | 'createdAt' | 'clientCount' | 'adminCount'>) {
    if (!editingPartner) return;
    updatePartner({ id: editingPartner.id, data });
    setEditingPartner(null);
  }

  const actions = [
    {
      label: 'Ver',
      onClick: (row: Partner) => setViewPartner(row),
    },
    {
      label: 'Editar',
      onClick: (row: Partner) => {
        setEditingPartner(row);
      },
    },
    {
      label: 'Desactivar',
      onClick: (row: Partner) => {
        updatePartner({ id: row.id, data: { status: 'inactive' } });
      },
    },
    {
      label: 'Eliminar',
      onClick: (row: Partner) => {
        deletePartner(row.id);
      },
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Socios / Partners</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Nuevo socio
        </button>
      </div>

      <FilterBar
        searchPlaceholder="Buscar socio..."
        onSearch={setPartnerSearch}
        filters={[{
          key: 'status',
          label: 'Estado',
          options: [
            { value: '', label: 'Todos' },
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
          ],
        }]}
        onFilterChange={(_key, value) => setPartnerStatus(value)}
      />
      <DataTable
        columns={columns}
        data={filteredPartners}
        loading={isLoading}
        actions={actions}
        emptyMessage="No hay socios registrados."
      />

      {showModal && (
        <PartnerFormModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          title="Nuevo socio"
          submitLabel="Guardar"
        />
      )}

      {editingPartner && (
        <PartnerFormModal
          initial={editingPartner}
          onClose={() => setEditingPartner(null)}
          onSubmit={handleUpdate}
          title="Editar socio"
          submitLabel="Actualizar"
        />
      )}

      {viewPartner && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Detalle de socio</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', margin: '1rem 0' }}>
              <dt style={{ fontWeight: 600 }}>Nombre</dt><dd>{viewPartner.name}</dd>
              <dt style={{ fontWeight: 600 }}>Email</dt><dd>{viewPartner.primaryEmail || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Teléfono</dt><dd>{viewPartner.phone || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Dirección</dt><dd>{viewPartner.address || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Ciudad</dt><dd>{viewPartner.city || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>País</dt><dd>{viewPartner.country}</dd>
              <dt style={{ fontWeight: 600 }}>Zona horaria</dt><dd>{viewPartner.timezone}</dd>
              <dt style={{ fontWeight: 600 }}>Moneda</dt><dd>{viewPartner.currency}</dd>
              <dt style={{ fontWeight: 600 }}>Clientes</dt><dd>{viewPartner.clientCount}</dd>
              <dt style={{ fontWeight: 600 }}>Estado</dt><dd>{viewPartner.status === 'active' ? 'Activo' : 'Inactivo'}</dd>
            </dl>
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={() => setViewPartner(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
