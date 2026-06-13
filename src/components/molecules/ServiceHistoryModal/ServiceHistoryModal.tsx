import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useContractServiceHistory } from '../../../hooks/useContractServiceHistory';
import { DataTable } from '../../organisms/DataTable/DataTable';
import { StatusBadge } from '../../atoms/StatusBadge/StatusBadge';
import type { ServiceHistoryEntry } from '../../../types/customer';
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
    render: (row: ServiceHistoryEntry) => new Date(row.createdAt).toLocaleDateString('es-AR'),
  },
  {
    key: 'deactivatedAt',
    label: 'Baja',
    render: (row: ServiceHistoryEntry) =>
      row.deactivatedAt ? new Date(row.deactivatedAt).toLocaleDateString('es-AR') : '—',
  },
];

export function ServiceHistoryModal({ open, onClose, contractId, contractName }: ServiceHistoryModalProps) {
  const { data = [], isLoading } = useContractServiceHistory(contractId, open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={DIALOG_TITLE_ID}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div>
            <h2 id={DIALOG_TITLE_ID} className={styles.title}>
              Historial de servicios
            </h2>
            {contractName && (
              <p className={styles.subtitle}>{contractName}</p>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
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
