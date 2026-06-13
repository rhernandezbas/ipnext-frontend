import { DataTable } from '@/components/organisms/DataTable/DataTable';
import {
  RECAPTURE_STATUS_LABELS,
  RECAPTURE_STATUS_COLOR,
} from '@/types/recaptacion';
import type { RecaptureLeadDto, RecaptureLeadStatus } from '@/types/recaptacion';
import { formatDateShort } from '@/utils/formatDate';
import styles from './RecaptacionTableView.module.css';

// ── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RecaptureLeadStatus }) {
  const color = RECAPTURE_STATUS_COLOR[status] ?? '#94a3b8';
  return (
    <span
      className={styles.statusPill}
      style={{ backgroundColor: color }}
      aria-label={`Estado: ${RECAPTURE_STATUS_LABELS[status]}`}
    >
      {RECAPTURE_STATUS_LABELS[status]}
    </span>
  );
}

// ── Column definitions ───────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  return formatDateShort(iso);
}

const COLUMNS: Array<{
  label: string;
  key: string;
  render?: (row: RecaptureLeadDto) => React.ReactNode;
}> = [
  {
    label: 'Contacto',
    key: 'contactName',
    render: (r) => <span className={styles.contactName}>{r.contactName}</span>,
  },
  {
    label: 'Teléfono',
    key: 'phone',
    render: (r) => r.phone ?? '—',
  },
  {
    label: 'Email',
    key: 'email',
    render: (r) => r.email ?? '—',
  },
  {
    label: 'Estado',
    key: 'status',
    render: (r) => <StatusPill status={r.status} />,
  },
  {
    label: 'Asignado',
    key: 'assigneeId',
    render: (r) => r.assigneeName ?? r.assigneeId ?? '—',
  },
  {
    label: 'Tomado el',
    key: 'claimedAt',
    render: (r) => formatDate(r.claimedAt),
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface RecaptacionTableViewProps {
  leads: RecaptureLeadDto[];
  loading?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onRowClick?: (lead: RecaptureLeadDto) => void;
}

export function RecaptacionTableView({
  leads,
  loading = false,
  hasActiveFilters = false,
  onClearFilters,
  onRowClick,
}: RecaptacionTableViewProps) {
  // Custom empty state so we can offer a "clear filters" CTA.
  if (!loading && leads.length === 0) {
    return (
      <div className={styles.empty} data-testid="recaptacion-empty-state">
        {hasActiveFilters ? (
          <>
            <p className={styles.emptyTitle}>Sin resultados para los filtros</p>
            <p className={styles.emptyHint}>Ajustá o limpiá los filtros para ver más leads.</p>
            <button type="button" className={styles.btnPrimary} onClick={onClearFilters}>
              Limpiar filtros
            </button>
          </>
        ) : (
          <>
            <p className={styles.emptyTitle}>No hay leads de recaptación</p>
            <p className={styles.emptyHint}>
              Ejecutá "Ingestar bajas" para cargar clientes dados de baja como leads.
            </p>
          </>
        )}
      </div>
    );
  }

  // Wrap columns to inject the row-click handler via render if present.
  const columns = onRowClick
    ? COLUMNS.map((col) => ({
        ...col,
        render: col.render
          ? (row: RecaptureLeadDto) => (
              <span
                onClick={() => onRowClick(row)}
                style={{ cursor: 'pointer' }}
              >
                {col.render!(row)}
              </span>
            )
          : undefined,
      }))
    : COLUMNS;

  return (
    <div className={styles.wrapper}>
      <DataTable<RecaptureLeadDto>
        columns={columns}
        data={leads}
        loading={loading}
        emptyMessage="No hay leads."
        actions={
          onRowClick
            ? [{ label: 'Ver detalle', onClick: onRowClick }]
            : undefined
        }
      />
    </div>
  );
}
