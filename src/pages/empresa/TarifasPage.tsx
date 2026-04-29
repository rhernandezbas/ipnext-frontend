import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useServicePlans, useCreateServicePlan, useUpdateServicePlan, useDeleteServicePlan } from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';
import styles from './TarifasPage.module.css';

type TypeFilter = '' | 'internet' | 'voip' | 'tv' | 'other';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'internet', label: 'Internet' },
  { value: 'voip', label: 'VoIP' },
  { value: 'tv', label: 'TV' },
  { value: 'other', label: 'Otro' },
];

const TYPE_LABELS: Record<ServicePlan['type'], string> = {
  internet: 'Internet',
  voip: 'VoIP',
  tv: 'TV',
  other: 'Otro',
};

const TYPE_CSS: Record<ServicePlan['type'], string> = {
  internet: styles.typeBadgeInternet,
  voip: styles.typeBadgeVoip,
  tv: styles.typeBadgeTv,
  other: styles.typeBadgeOther,
};

const BILLING_LABELS: Record<ServicePlan['billingCycle'], string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function TypeBadge({ type }: { type: ServicePlan['type'] }) {
  return (
    <span className={`${styles.typeBadge} ${TYPE_CSS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function PlanStatus({ status }: { status: ServicePlan['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR')}`;
}

function formatSpeed(plan: ServicePlan): string {
  if (plan.downloadSpeed === 0 && plan.uploadSpeed === 0) return '—';
  return `↓${plan.downloadSpeed} ↑${plan.uploadSpeed} Mbps`;
}

interface PlanModalProps {
  initialData?: ServicePlan;
  title: string;
  onClose: () => void;
  onSubmit: (data: Omit<ServicePlan, 'id'>) => void;
}

function NewPlanModal({ initialData, title, onClose, onSubmit }: PlanModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<ServicePlan['type']>(initialData?.type ?? 'internet');
  const [downloadSpeed, setDownloadSpeed] = useState(initialData?.downloadSpeed ?? 0);
  const [uploadSpeed, setUploadSpeed] = useState(initialData?.uploadSpeed ?? 0);
  const [price, setPrice] = useState(initialData?.price ?? 0);
  const [billingCycle, setBillingCycle] = useState<ServicePlan['billingCycle']>(initialData?.billingCycle ?? 'monthly');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [status, setStatus] = useState<ServicePlan['status']>(initialData?.status ?? 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, type, downloadSpeed, uploadSpeed, price, billingCycle, status, description, subscriberCount: initialData?.subscriberCount ?? 0 });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="plan-name">Nombre</label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="plan-type">Tipo</label>
            <select id="plan-type" value={type} onChange={e => setType(e.target.value as ServicePlan['type'])}>
              <option value="internet">Internet</option>
              <option value="voip">VoIP</option>
              <option value="tv">TV</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="plan-download">Velocidad descarga (Mbps)</label>
              <input
                id="plan-download"
                type="number"
                value={downloadSpeed}
                onChange={e => setDownloadSpeed(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="plan-upload">Velocidad subida (Mbps)</label>
              <input
                id="plan-upload"
                type="number"
                value={uploadSpeed}
                onChange={e => setUploadSpeed(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="plan-price">Precio (ARS)</label>
              <input
                id="plan-price"
                type="number"
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                min={0}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="plan-billing">Ciclo de facturación</label>
              <select
                id="plan-billing"
                value={billingCycle}
                onChange={e => setBillingCycle(e.target.value as ServicePlan['billingCycle'])}
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="plan-description">Descripción</label>
            <input
              id="plan-description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="plan-status">Estado</label>
            <select
              id="plan-status"
              value={status}
              onChange={e => setStatus(e.target.value as ServicePlan['status'])}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar plan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const columns = [
  { label: 'Nombre', key: 'name' as keyof ServicePlan },
  {
    label: 'Tipo',
    key: 'type' as keyof ServicePlan,
    render: (row: ServicePlan) => <TypeBadge type={row.type} />,
  },
  {
    label: 'Velocidad',
    key: 'downloadSpeed' as keyof ServicePlan,
    render: (row: ServicePlan) => formatSpeed(row),
  },
  {
    label: 'Precio',
    key: 'price' as keyof ServicePlan,
    render: (row: ServicePlan) => `${formatPrice(row.price)}/mes`,
  },
  {
    label: 'Ciclo',
    key: 'billingCycle' as keyof ServicePlan,
    render: (row: ServicePlan) => BILLING_LABELS[row.billingCycle],
  },
  {
    label: 'Estado',
    key: 'status' as keyof ServicePlan,
    render: (row: ServicePlan) => <PlanStatus status={row.status} />,
  },
  { label: 'Suscriptores', key: 'subscriberCount' as keyof ServicePlan },
];

export default function TarifasPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);

  const { data: plans = [], isLoading } = useServicePlans();
  const { mutate: createPlan } = useCreateServicePlan();
  const { mutate: updatePlan } = useUpdateServicePlan();
  const { mutate: deletePlan } = useDeleteServicePlan();

  const filtered = plans.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const actions = [
    {
      label: 'Editar',
      onClick: (row: ServicePlan) => {
        setEditingPlan(row);
      },
    },
    {
      label: 'Activar/Desactivar',
      onClick: (row: ServicePlan) => {
        updatePlan({ id: row.id, data: { status: row.status === 'active' ? 'inactive' : 'active' } });
      },
    },
    {
      label: 'Eliminar',
      onClick: (row: ServicePlan) => {
        deletePlan(row.id);
      },
    },
  ];

  function handleCreate(data: Omit<ServicePlan, 'id'>) {
    createPlan(data);
    setShowModal(false);
  }

  function handleEdit(data: Omit<ServicePlan, 'id'>) {
    if (!editingPlan) return;
    updatePlan({ id: editingPlan.id, data });
    setEditingPlan(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tarifas / Planes de servicio</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Nuevo plan
        </button>
      </div>

      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar plan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
        >
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        actions={actions}
        emptyMessage="No se encontraron planes."
      />

      {showModal && (
        <NewPlanModal
          title="Nuevo plan"
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingPlan && (
        <NewPlanModal
          title="Editar plan"
          initialData={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
