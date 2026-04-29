import { DataTable } from '../../../components/organisms/DataTable/DataTable';
import { StatusBadge } from '../../../components/atoms/StatusBadge/StatusBadge';
import { useClientInvoices } from '../../../hooks/useClients';
import type { Invoice, InvoiceStatus } from '../../../types/billing';
import styles from './Tab.module.css';

function invoiceStatusToBadge(s: InvoiceStatus): 'active' | 'late' | 'blocked' | 'inactive' {
  const map: Record<InvoiceStatus, 'active' | 'late' | 'blocked' | 'inactive'> = {
    paid: 'active',
    sent: 'inactive',
    draft: 'inactive',
    overdue: 'late',
    cancelled: 'blocked',
  };
  return map[s];
}

const COLUMNS = [
  { label: 'Número', key: 'number' as keyof Invoice },
  { label: 'Fecha', key: 'issuedAt' as keyof Invoice },
  {
    label: 'Monto',
    key: 'total' as keyof Invoice,
    render: (row: Invoice) => `$${row.total.toFixed(2)}`,
  },
  {
    label: 'Estado',
    key: 'status' as keyof Invoice,
    render: (row: Invoice) => <StatusBadge status={invoiceStatusToBadge(row.status)} />,
  },
];

interface Props { clientId: string; active: boolean; }

export function FacturacionTab({ clientId, active }: Props) {
  const { data, isLoading } = useClientInvoices(clientId, active);
  const invoices = data ?? [];

  const pending = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const pendingTotal = pending.reduce((sum, i) => sum + i.total, 0);
  const nextDue = [...invoices]
    .filter((i) => i.status === 'sent')
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt;

  return (
    <div className={styles.tab}>
      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Saldo pendiente</span>
          <span className={styles.cardValue}>${pendingTotal.toFixed(2)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Próximo vencimiento</span>
          <span className={styles.cardValue}>{nextDue || '—'}</span>
        </div>
      </div>
      <DataTable
        columns={COLUMNS}
        data={invoices}
        loading={isLoading}
        emptyMessage="No hay facturas."
      />
    </div>
  );
}
