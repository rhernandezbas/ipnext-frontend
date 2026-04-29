import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useFinanceHistory } from '@/hooks/useBilling';
import type { FinanceHistoryEvent, FinanceEventType } from '@/types/billing';
import styles from './finanzas.module.css';

const EVENT_TYPE_LABELS: Record<FinanceEventType, string> = {
  invoice_created: 'Factura creada',
  invoice_paid: 'Factura pagada',
  payment_received: 'Pago recibido',
  credit_note_applied: 'NC aplicada',
  refund: 'Reembolso',
  late_fee: 'Cargo por mora',
  plan_changed: 'Plan cambiado',
  service_activated: 'Servicio activado',
  service_deactivated: 'Servicio desactivado',
};

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'invoice_created', label: 'Factura creada' },
  { value: 'invoice_paid', label: 'Factura pagada' },
  { value: 'payment_received', label: 'Pago recibido' },
  { value: 'credit_note_applied', label: 'NC aplicada' },
  { value: 'refund', label: 'Reembolso' },
  { value: 'late_fee', label: 'Cargo por mora' },
  { value: 'plan_changed', label: 'Plan cambiado' },
  { value: 'service_activated', label: 'Servicio activado' },
  { value: 'service_deactivated', label: 'Servicio desactivado' },
];

const COLUMNS = [
  {
    label: 'Fecha/hora',
    key: 'occurredAt' as keyof FinanceHistoryEvent,
    render: (row: FinanceHistoryEvent) => new Date(row.occurredAt).toLocaleString('es-AR'),
  },
  {
    label: 'Tipo',
    key: 'type' as keyof FinanceHistoryEvent,
    render: (row: FinanceHistoryEvent) => EVENT_TYPE_LABELS[row.type] ?? row.type,
  },
  { label: 'Descripción', key: 'description' as keyof FinanceHistoryEvent },
  { label: 'Cliente', key: 'clientName' as keyof FinanceHistoryEvent },
  {
    label: 'Monto',
    key: 'amount' as keyof FinanceHistoryEvent,
    render: (row: FinanceHistoryEvent) => row.amount != null ? `$${row.amount.toFixed(2)}` : '—',
  },
  {
    label: 'Referencia',
    key: 'referenceId' as keyof FinanceHistoryEvent,
    render: (row: FinanceHistoryEvent) => row.referenceId ?? '—',
  },
  { label: 'Admin', key: 'adminName' as keyof FinanceHistoryEvent },
];

export default function HistorialFinancieroPage() {
  const [clientId, setClientId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<{ clientId?: string; from?: string; to?: string }>({});

  const { data: events = [], isLoading } = useFinanceHistory(appliedFilter);

  const filtered = typeFilter
    ? events.filter(e => e.type === typeFilter)
    : events;

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setAppliedFilter({
      clientId: clientId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Historial financiero</h1>
      </div>

      <form className={styles.filterRow} onSubmit={handleFilter}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Cliente (ID)"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          aria-label="Cliente"
        />
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          aria-label="Tipo de evento"
        >
          {EVENT_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          className={styles.filterInput}
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          aria-label="Desde"
        />
        <input
          className={styles.filterInput}
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          aria-label="Hasta"
        />
        <button type="submit" className={styles.btnPrimary}>
          Filtrar
        </button>
      </form>

      <DataTable
        columns={COLUMNS}
        data={filtered}
        loading={isLoading}
        emptyMessage="No hay eventos en el historial."
      />
    </div>
  );
}
