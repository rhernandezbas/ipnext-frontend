import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContractServiceHistory } from '../../../hooks/useContractServiceHistory';
import { StatusBadge } from '../../atoms/StatusBadge/StatusBadge';
import { ReasonViewModal } from '../ReasonViewModal/ReasonViewModal';
import type { ServiceHistoryEntry, ServiceEvent } from '../../../types/customer';
import { formatDateShort, formatDateTimeShort } from '@/utils/formatDate';
import styles from './ServiceHistoryModal.module.css';

interface ServiceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractName?: string;
}

const DIALOG_TITLE_ID = 'service-history-modal-title';

// ── Event type badge ───────────────────────────────────────────────────────────

const EVENT_LABELS: Record<ServiceEvent['eventType'], string> = {
  activated: 'Alta',
  deactivated: 'Baja',
  reactivated: 'Reactivación',
};

function EventBadge({ type }: { type: ServiceEvent['eventType'] }) {
  const label = EVENT_LABELS[type];
  if (type === 'activated') return <span className={styles.badgeAlta}>{label}</span>;
  if (type === 'deactivated') return <span className={styles.badgeBaja}>{label}</span>;
  return <span className={styles.badgeReactivacion}>{label}</span>;
}

// ── Events sub-table ───────────────────────────────────────────────────────────

function EventsTable({ events, showCic }: { events: ServiceEvent[]; showCic: boolean }) {
  const [activeReason, setActiveReason] = useState<string | null>(null);

  if (events.length === 0) return null;
  return (
    <>
      <table className={styles.eventsTable}>
        <thead>
          <tr>
            <th>Fecha/hora</th>
            <th>Tipo</th>
            {showCic && <th>CIC</th>}
            <th>Operador</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id}>
              <td>{formatDateTimeShort(ev.occurredAt)}</td>
              <td><EventBadge type={ev.eventType} /></td>
              {showCic && <td>{ev.cic ?? '—'}</td>}
              <td>{ev.actorName}</td>
              <td>
                {ev.reason ? (
                  <button
                    type="button"
                    className={styles.reasonLink}
                    aria-label="Ver motivo"
                    onClick={() => setActiveReason(ev.reason!)}
                  >
                    ver
                  </button>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {activeReason !== null && (
        <ReasonViewModal
          open
          reason={activeReason}
          onClose={() => setActiveReason(null)}
        />
      )}
    </>
  );
}

// ── Service row ────────────────────────────────────────────────────────────────

function ServiceRow({ entry }: { entry: ServiceHistoryEntry }) {
  const hasEvents = Array.isArray(entry.events) && entry.events.length > 0;
  // Show the CIC column only when the service is TV or any event has a CIC value.
  // Non-TV services (FIBER, etc.) never have CICs — hiding the column reduces noise.
  const showCic =
    entry.tvLogin !== null ||
    (Array.isArray(entry.events) && entry.events.some((ev) => ev.cic !== null));
  return (
    <div className={styles.serviceBlock}>
      <div className={styles.serviceHeader}>
        <span className={styles.serviceName}>{entry.label ?? entry.name}</span>
        <StatusBadge
          status={entry.status}
          label={entry.status === 'inactive' ? 'Baja' : undefined}
        />
        <span className={styles.serviceMeta}>
          Contratado: {formatDateShort(entry.createdAt)}
          {entry.deactivatedAt && (
            <> · Baja: {formatDateShort(entry.deactivatedAt)}</>
          )}
        </span>
        {entry.notes && (
          <span className={styles.serviceNotes}>{entry.notes}</span>
        )}
        {entry.tvLogin && (
          <span className={styles.tvLogin}>Login TV: {entry.tvLogin}</span>
        )}
      </div>
      {hasEvents && <EventsTable events={entry.events} showCic={showCic} />}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export function ServiceHistoryModal({ open, onClose, contractId, contractName }: ServiceHistoryModalProps) {
  const { data = [], isLoading } = useContractServiceHistory(contractId, open);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // #73 re-review — move focus into the modal on open so keyboard users land
    // inside it (ConfirmModal pattern). The close button is the first focusable.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      // Restore focus to whatever triggered the modal (the "Historial" button).
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <div className={styles.header}>
          <div>
            <h2 id={DIALOG_TITLE_ID} className={styles.title}>
              Historial de servicios
            </h2>
            {contractName && (
              <p className={styles.subtitle}>{contractName}</p>
            )}
          </div>
          <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {isLoading && (
            <p className={styles.loadingMsg}>Cargando…</p>
          )}
          {!isLoading && data.length === 0 && (
            <p className={styles.emptyMsg}>Sin historial de servicios para este contrato.</p>
          )}
          {!isLoading && data.length > 0 && (
            <div className={styles.serviceList}>
              {data.map((entry) => (
                <ServiceRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
