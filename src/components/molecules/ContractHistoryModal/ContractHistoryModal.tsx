import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClientContracts } from '@/hooks/useCustomers';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import type { Contract } from '@/types/customer';
import { formatDateShort } from '@/utils/formatDate';
import styles from './ContractHistoryModal.module.css';

interface ContractHistoryModalProps {
  open: boolean;
  onClose: () => void;
  /** Client whose contracts to list. The caller must guarantee a non-null id. */
  clientId: string;
  clientName?: string;
}

const DIALOG_TITLE_ID = 'contract-history-modal-title';

// ── Contract card ──────────────────────────────────────────────────────────────

type BadgeStatus = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

/** Map the GR customer status onto a StatusBadge presentation variant.
 *  Mirrors ContractCard.badgeStatus so the same status looks identical everywhere. */
function badgeStatus(status: string): BadgeStatus {
  switch (status) {
    case 'active': return 'active';
    case 'blocked': return 'blocked';
    case 'baja': return 'baja';
    default: return 'inactive';
  }
}

function ContractCard({ contract }: { contract: Contract }) {
  const title = contract.name ?? contract.plan;
  // The address is the field the user explicitly asked for. It can be null on
  // non-GR contracts — be honest rather than inventing one.
  const address = contract.address?.trim() || 'Sin domicilio registrado';

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{title}</span>
        <StatusBadge status={badgeStatus(contract.status)} />
        {contract.code && <span className={styles.codeBadge}>#{contract.code}</span>}
      </div>
      <dl className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <dt className={styles.metaLabel}>Plan</dt>
          <dd className={styles.metaValue}>{contract.plan}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt className={styles.metaLabel}>Tecnología</dt>
          <dd className={styles.metaValue}>{contract.technology ?? '—'}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt className={styles.metaLabel}>Alta</dt>
          <dd className={styles.metaValue}>{formatDateShort(contract.startDate)}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt className={styles.metaLabel}>Baja</dt>
          <dd className={styles.metaValue}>
            {contract.endDate ? formatDateShort(contract.endDate) : '—'}
          </dd>
        </div>
        <div className={`${styles.metaItem} ${styles.metaFull}`}>
          <dt className={styles.metaLabel}>Domicilio de instalación</dt>
          <dd className={styles.metaValue}>{address}</dd>
        </div>
        {contract.ip && (
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>IP</dt>
            <dd className={styles.metaValue}>{contract.ip}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export function ContractHistoryModal({ open, onClose, clientId, clientName }: ContractHistoryModalProps) {
  const { data: contracts = [], isLoading } = useClientContracts(clientId, open);
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={DIALOG_TITLE_ID}>
        <div className={styles.header}>
          <div>
            <h2 id={DIALOG_TITLE_ID} className={styles.title}>Contratos del cliente</h2>
            {clientName && <p className={styles.subtitle}>{clientName}</p>}
          </div>
          <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {isLoading && <p className={styles.stateMsg}>Cargando…</p>}
          {!isLoading && contracts.length === 0 && (
            <p className={styles.stateMsg}>Este cliente no tiene contratos registrados.</p>
          )}
          {!isLoading && contracts.length > 0 && (
            <div className={styles.list}>
              {contracts.map((c) => <ContractCard key={c.id} contract={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
