import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useContractServiceHistory } from '../../../hooks/useContractServiceHistory';
import { DataTable } from '../../organisms/DataTable/DataTable';
import { StatusBadge } from '../../atoms/StatusBadge/StatusBadge';
import type { ServiceHistoryEntry } from '../../../types/customer';
import { formatDateShort } from '@/utils/formatDate';
import styles from './ServiceHistoryModal.module.css';

interface ServiceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractName?: string;
}

const DIALOG_TITLE_ID = 'service-history-modal-title';

const columns = [
  {
    key: 'service',
    label: 'Servicio',
    render: (row: ServiceHistoryEntry) => row.label ?? row.name,
  },
  {
    key: 'status',
    label: 'Estado',
    render: (row: ServiceHistoryEntry) => (
      <StatusBadge
        status={row.status}
        label={row.status === 'inactive' ? 'Baja' : undefined}
      />
    ),
  },
  {
    key: 'data',
    label: 'Datos',
    render: (row: ServiceHistoryEntry) => {
      if (!row.notes && !row.tvLogin) return '—';
      return (
        <span>
          {row.notes && <span>{row.notes}</span>}
          {row.tvLogin && <span className={styles.tvLogin}>Login: {row.tvLogin}</span>}
        </span>
      );
    },
  },
  {
    key: 'createdAt',
    label: 'Contratado',
    render: (row: ServiceHistoryEntry) => formatDateShort(row.createdAt),
  },
  {
    key: 'deactivatedAt',
    label: 'Baja',
    render: (row: ServiceHistoryEntry) =>
      formatDateShort(row.deactivatedAt),
  },
];

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
          <DataTable<ServiceHistoryEntry>
            columns={columns}
            data={data}
            loading={isLoading}
            emptyMessage="Sin historial de servicios para este contrato."
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
