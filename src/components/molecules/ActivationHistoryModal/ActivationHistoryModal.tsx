/**
 * ActivationHistoryModal (#2 + #5B).
 *
 * Wraps the TV activation history (alta/baja/reactivación log) in a portal
 * modal, mirroring ServiceHistoryModal's pattern (backdrop, Esc, focus, portal,
 * role=dialog).
 *
 * Two modes:
 *   - Global (no customerId): shows all events with filters (from/to/actor/client).
 *     Uses useGigaredActivationHistory.
 *   - Per-client (customerId provided): shows only that client's events.
 *     Uses useGigaredCustomerActivationHistory. No cross-client filter bar.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  useGigaredActivationHistory,
  useGigaredCustomerActivationHistory,
} from '@/hooks/useGigared';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { TvActivationEvent, ActivationHistoryFilter } from '@/types/gigared';
import styles from './ActivationHistoryModal.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivationHistoryModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When provided, the modal shows ONLY this client's TV events (per-client
   * mode). When omitted, shows global events with a filter bar.
   */
  customerId?: string;
}

type Row = TvActivationEvent & { id: string };

const DIALOG_TITLE_ID = 'activation-history-modal-title';

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
    key: 'cic',
    label: 'CIC',
    render: (r: Row) => r.cic ?? '—',
  },
  {
    key: 'customer',
    label: 'Cliente',
    render: (r: Row) => {
      const name = r.customerName ?? '—';
      return r.clientId ? (
        <Link className={styles.nameLink} to={`/admin/customers/view/${r.clientId}`}>
          {name}
        </Link>
      ) : (
        <span>{name}</span>
      );
    },
  },
  {
    key: 'actorName',
    label: 'Operador',
    render: (r: Row) => r.actorName,
  },
];

// ── Per-client body ───────────────────────────────────────────────────────────

function PerClientBody({ customerId, open }: { customerId: string; open: boolean }) {
  const { data, isLoading } = useGigaredCustomerActivationHistory(customerId, open);
  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));
  return (
    <div className={styles.body}>
      <DataTable
        columns={COLUMNS}
        data={rows}
        loading={isLoading}
        emptyMessage="Sin eventos para este cliente."
      />
    </div>
  );
}

// ── Global body (with filters) ────────────────────────────────────────────────

function GlobalBody() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState('');
  const [customerId, setCustomerId] = useState('');

  const filter: ActivationHistoryFilter = {};
  if (from) filter.from = from;
  if (to) filter.to = to;
  if (actorId.trim()) filter.actorId = actorId.trim();
  if (customerId.trim()) filter.customerId = customerId.trim();

  const { data, isLoading, isError } = useGigaredActivationHistory(filter);

  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));

  return (
    <>
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="ahm-from" className={styles.filterLabel}>Desde</label>
          <input
            id="ahm-from"
            type="date"
            className={styles.input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Desde"
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="ahm-to" className={styles.filterLabel}>Hasta</label>
          <input
            id="ahm-to"
            type="date"
            className={styles.input}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="ahm-actor" className={styles.filterLabel}>Operador (ID)</label>
          <input
            id="ahm-actor"
            type="text"
            className={styles.input}
            placeholder="ID de operador…"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="ahm-customer" className={styles.filterLabel}>Cliente (ID)</label>
          <input
            id="ahm-customer"
            type="text"
            className={styles.input}
            placeholder="ID de cliente…"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>
      </div>

      {isError && (
        <div className={styles.bannerError}>
          Error al cargar el historial de activaciones TV.
        </div>
      )}

      <div className={styles.body}>
        <DataTable
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          emptyMessage="Sin eventos para el filtro."
        />
      </div>
    </>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function ActivationHistoryModal({ open, onClose, customerId }: ActivationHistoryModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <div className={styles.header}>
          <h2 id={DIALOG_TITLE_ID} className={styles.title}>
            Historial TV
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {customerId ? (
          <PerClientBody customerId={customerId} open={open} />
        ) : (
          <GlobalBody />
        )}
      </div>
    </div>,
    document.body,
  );
}
