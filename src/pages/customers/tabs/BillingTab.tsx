import { DataTable } from '../../../components/organisms/DataTable/DataTable';
import { StatusBadge } from '../../../components/atoms/StatusBadge/StatusBadge';
import { useClientInvoices } from '../../../hooks/useCustomers';
import type { ClientInvoice, ClientInvoiceStatus } from '../../../types/billing';
import { formatDateShort } from '@/utils/formatDate';
import styles from './Tab.module.css';

/** ARS money, consistent with CustomerDetailPage.formatBalance ("$ 1.234,56"). */
const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formatMoney = (n: number): string => moneyFmt.format(n);

// GR status → shared StatusBadge variant. Aligned with FacturasPage's convention
// (paid→active, sent→inactive, overdue→late). The app has no dedicated "green"
// variant; `active` (blue #dbeafe/#1e40af) is its positive/success semantic.
const STATUS_BADGE: Record<ClientInvoiceStatus, 'active' | 'inactive' | 'late'> = {
  pagada: 'active', // positive
  pendiente: 'inactive', // neutral
  vencida: 'late', // danger / red
};

const STATUS_LABEL: Record<ClientInvoiceStatus, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
};

/** Row action: a real anchor (keyboard-accessible, new tab, safe rel). */
function ActionLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className={styles.actionLink}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function InvoiceActions({ row }: { row: ClientInvoice }) {
  if (!row.pdfUrl && !row.couponPdfUrl && !row.paymentUrl) {
    return <span className={styles.actionsEmpty}>—</span>;
  }
  return (
    <div className={styles.actions}>
      {row.pdfUrl && <ActionLink href={row.pdfUrl}>PDF</ActionLink>}
      {row.couponPdfUrl && <ActionLink href={row.couponPdfUrl}>Cupón</ActionLink>}
      {row.paymentUrl && <ActionLink href={row.paymentUrl}>MercadoPago</ActionLink>}
    </div>
  );
}

const COLUMNS = [
  { label: 'Número', key: 'number' as const },
  {
    label: 'Emisión',
    key: 'issueDate' as const,
    render: (row: ClientInvoice) => formatDateShort(row.issueDate),
  },
  {
    label: 'Vencimiento',
    key: 'dueDate' as const,
    render: (row: ClientInvoice) => formatDateShort(row.dueDate),
  },
  {
    label: 'Importe',
    key: 'amount' as const,
    render: (row: ClientInvoice) => formatMoney(row.amount),
  },
  {
    label: 'Saldo',
    key: 'balance' as const,
    render: (row: ClientInvoice) => formatMoney(row.balance),
  },
  {
    label: 'Estado',
    key: 'status' as const,
    render: (row: ClientInvoice) => (
      <StatusBadge status={STATUS_BADGE[row.status]} label={STATUS_LABEL[row.status]} />
    ),
  },
  {
    label: 'Acciones',
    key: 'acciones',
    render: (row: ClientInvoice) => <InvoiceActions row={row} />,
  },
];

interface Props { clientId: string; active: boolean; }

export function BillingTab({ clientId, active }: Props) {
  const { data, isLoading } = useClientInvoices(clientId, active);
  const invoices = data ?? [];

  // KPIs consider only invoices that are still owed (anything not "pagada").
  const unpaid = invoices.filter((i) => i.status !== 'pagada');
  const pendingTotal = unpaid.reduce((sum, i) => sum + i.balance, 0);
  const nextDue = [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate;

  return (
    <div className={styles.tab}>
      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Saldo pendiente</span>
          <span className={styles.cardValue}>{formatMoney(pendingTotal)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Próximo vencimiento</span>
          <span className={styles.cardValue}>{nextDue ? formatDateShort(nextDue) : '—'}</span>
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
