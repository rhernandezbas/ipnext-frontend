/**
 * InternetActivationHistoryModal — espejo de ActivationHistoryModal (TV) para
 * el historial de servicios de Internet.
 *
 * Modo per-cliente: muestra los eventos (alta/baja/reactivación) de un cliente
 * en un modal portal (backdrop, Esc, focus, role=dialog). Columnas:
 *   Fecha · Tipo · Operador · Motivo (el motivo abre ReasonViewModal).
 * Consume useInternetActivationHistory({ clientId }).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInternetActivationHistory } from '@/hooks/useInternetServices';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { ReasonViewModal } from '@/components/molecules/ReasonViewModal/ReasonViewModal';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { InternetServiceEvent } from '@/types/internetService';
import styles from './InternetActivationHistoryModal.module.css';

export interface InternetActivationHistoryModalProps {
  open: boolean;
  onClose: () => void;
  /** Cliente cuyos eventos de Internet se muestran. */
  clientId: string;
  /** Etiqueta opcional del cliente para el subtítulo. */
  customerName?: string | null;
}

type Row = InternetServiceEvent & { id: string };

const DIALOG_TITLE_ID = 'internet-activation-history-modal-title';

function EventTypeBadge({ type }: { type: InternetServiceEvent['eventType'] }) {
  if (type === 'alta') return <span className={styles.badgeAlta}>Alta</span>;
  if (type === 'baja') return <span className={styles.badgeBaja}>Baja</span>;
  return <span className={styles.badgeReactivacion}>Reactivación</span>;
}

function buildColumns(onViewReason: (reason: string) => void) {
  return [
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
      key: 'actorName',
      label: 'Operador',
      render: (r: Row) => r.actorName,
    },
    {
      key: 'reason',
      label: 'Motivo',
      render: (r: Row) =>
        r.reason ? (
          <button
            type="button"
            className={styles.reasonLink}
            aria-label="Ver motivo"
            onClick={() => onViewReason(r.reason!)}
          >
            ver
          </button>
        ) : (
          '—'
        ),
    },
  ];
}

export function InternetActivationHistoryModal({
  open,
  onClose,
  clientId,
  customerName,
}: InternetActivationHistoryModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [activeReason, setActiveReason] = useState<string | null>(null);

  const { data, isLoading, isError } = useInternetActivationHistory({ clientId }, open);

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

  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));
  const columns = buildColumns(setActiveReason);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={DIALOG_TITLE_ID}>
        <div className={styles.header}>
          <div>
            <h2 id={DIALOG_TITLE_ID} className={styles.title}>
              Historial de Internet
            </h2>
            {customerName && <p className={styles.subtitle}>{customerName}</p>}
          </div>
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

        {isError && (
          <div className={styles.bannerError}>
            Error al cargar el historial de Internet.
          </div>
        )}

        <div className={styles.body}>
          <DataTable
            columns={columns}
            data={rows}
            loading={isLoading}
            emptyMessage="Sin eventos para este cliente."
          />
        </div>
      </div>

      {activeReason !== null && (
        <ReasonViewModal open reason={activeReason} onClose={() => setActiveReason(null)} />
      )}
    </div>,
    document.body,
  );
}
