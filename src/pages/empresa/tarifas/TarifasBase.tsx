import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useServicePlans, useCreateServicePlan } from '@/hooks/useEmpresa';
import type { ServicePlan, PlanSubtype } from '@/types/empresa';
import styles from '../TarifasPage.module.css';

export interface TarifasBaseProps {
  subtype: PlanSubtype;
  title: string;
  showSpeed?: boolean;
}

const BILLING_LABELS: Record<ServicePlan['billingCycle'], string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR')}`;
}

function formatSpeed(plan: ServicePlan): string {
  if (plan.downloadSpeed === 0 && plan.uploadSpeed === 0) return '—';
  return `↓${plan.downloadSpeed} ↑${plan.uploadSpeed} Mbps`;
}

function PlanStatus({ status }: { status: ServicePlan['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export function TarifasBase({ subtype, title, showSpeed = false }: TarifasBaseProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);

  const { data: allPlans = [], isLoading } = useServicePlans();
  const { mutate: createPlan } = useCreateServicePlan();

  const filtered = allPlans.filter(p => p.planSubtype === subtype);

  const baseColumns = [
    { label: 'Nombre', key: 'name' as keyof ServicePlan },
    {
      label: 'Velocidad',
      key: 'downloadSpeed' as keyof ServicePlan,
      render: (row: ServicePlan) => showSpeed ? formatSpeed(row) : '—',
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createPlan({
      name,
      type: subtype === 'internet' ? 'internet' : subtype === 'voice' ? 'voip' : 'other',
      planSubtype: subtype,
      downloadSpeed,
      uploadSpeed,
      price,
      billingCycle: 'monthly',
      status: 'active',
      description,
      subscriberCount: 0,
    });
    setShowModal(false);
    setName('');
    setPrice(0);
    setDescription('');
    setDownloadSpeed(0);
    setUploadSpeed(0);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Nueva tarifa
        </button>
      </div>

      <DataTable
        columns={baseColumns}
        data={filtered}
        loading={isLoading}
        emptyMessage="No se encontraron tarifas."
      />

      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Nueva tarifa</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="tarifa-name">Nombre</label>
                <input
                  id="tarifa-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {showSpeed && (
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="tarifa-download">Descarga (Mbps)</label>
                    <input
                      id="tarifa-download"
                      type="number"
                      value={downloadSpeed}
                      onChange={e => setDownloadSpeed(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="tarifa-upload">Subida (Mbps)</label>
                    <input
                      id="tarifa-upload"
                      type="number"
                      value={uploadSpeed}
                      onChange={e => setUploadSpeed(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                </div>
              )}
              <div className={styles.formGroup}>
                <label htmlFor="tarifa-price">Precio (ARS)</label>
                <input
                  id="tarifa-price"
                  type="number"
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  min={0}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="tarifa-description">Descripción</label>
                <input
                  id="tarifa-description"
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Guardar plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
