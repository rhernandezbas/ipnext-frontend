/**
 * GigaredActivationHistoryPage — TV activation history subpage (#5 FE).
 *
 * Shows a chronological (newest first) log of TV activation events:
 * alta / baja / reactivación, with operator, customer, and date.
 * Filters: operator (actorId via select when list is available, else text),
 * customer search (customerId), date range (from / to).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGigaredActivationHistory } from '@/hooks/useGigared';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { TvActivationEvent, ActivationHistoryFilter } from '@/types/gigared';
import styles from './GigaredActivationHistoryPage.module.css';

type Row = TvActivationEvent & { id: string };

// ── Event type badge ──────────────────────────────────────────────────────────

function EventTypeBadge({ type }: { type: TvActivationEvent['eventType'] }) {
  if (type === 'alta') return <span className={styles.badgeAlta}>Alta</span>;
  if (type === 'baja') return <span className={styles.badgeBaja}>Baja</span>;
  return <span className={styles.badgeReactivacion}>Reactivación</span>;
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: 'createdAt',
    label: 'Fecha/hora',
    render: (r: Row) => formatDateTimeShort(r.createdAt),
  },
  {
    key: 'eventType',
    label: 'Tipo',
    render: (r: Row) => <EventTypeBadge type={r.eventType} />,
  },
  {
    key: 'customer',
    label: 'Cliente',
    render: (r: Row) => {
      const name = r.customerName ?? '—';
      const nameNode = r.clientId ? (
        <Link className={styles.nameLink} to={`/admin/customers/view/${r.clientId}`}>
          {name}
        </Link>
      ) : (
        <span>{name}</span>
      );
      return (
        <div>
          {nameNode}
          {r.cic && <div className={styles.cic}>{r.cic}</div>}
        </div>
      );
    },
  },
  {
    key: 'actorName',
    label: 'Operador',
    render: (r: Row) => r.actorName,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GigaredActivationHistoryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [actorId, setActorId] = useState('');

  const filter: ActivationHistoryFilter = {};
  if (from) filter.from = from;
  if (to) filter.to = to;
  if (customerId.trim()) filter.customerId = customerId.trim();
  if (actorId.trim()) filter.actorId = actorId.trim();

  const { data, isLoading, isError } = useGigaredActivationHistory(filter);

  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>CRM /</span>
        <h1 className={styles.title}>Historial TV</h1>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="hist-from" className={styles.filterLabel}>Desde</label>
          <input
            id="hist-from"
            type="date"
            className={styles.input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Desde"
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="hist-to" className={styles.filterLabel}>Hasta</label>
          <input
            id="hist-to"
            type="date"
            className={styles.input}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="hist-actor" className={styles.filterLabel}>Operador (ID)</label>
          <input
            id="hist-actor"
            type="text"
            className={styles.input}
            placeholder="ID de operador…"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            aria-label="Operador"
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="hist-customer" className={styles.filterLabel}>Cliente (ID)</label>
          <input
            id="hist-customer"
            type="text"
            className={styles.input}
            placeholder="ID de cliente…"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            aria-label="Cliente"
          />
        </div>
      </div>

      {isError && (
        <div className={styles.bannerError}>
          Error al cargar el historial de activaciones TV.
        </div>
      )}

      <DataTable
        columns={COLUMNS}
        data={rows}
        loading={isLoading}
        emptyMessage="Sin eventos para el filtro."
      />
    </div>
  );
}
