import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Button } from '@/components/atoms/Button';
import {
  RECAPTURE_STATUS_LABELS,
  RECAPTURE_STATUS_COLOR,
} from '@/types/recaptacion';
import type { RecaptureLeadDto, RecaptureLeadStatus } from '@/types/recaptacion';
import type { AssigneeOption } from './BulkAssignToolbar';
import { formatDateShort } from '@/utils/formatDate';
import styles from './RecaptacionTableView.module.css';

// ── Inline assign select ───────────────────────────────────────────────────────

interface InlineAssignSelectProps {
  lead: RecaptureLeadDto;
  operators: AssigneeOption[];
  onAssign: (leadId: string, operatorId: string | null) => void;
  disabled: boolean;
}

/**
 * Editable assignee cell. Reuses the same operator pool as the bulk toolbar
 * (RbacUsers). `stopPropagation` keeps clicks/changes from bubbling to the
 * row-click wrapper that opens the detail drawer.
 */
function InlineAssignSelect({ lead, operators, onAssign, disabled }: InlineAssignSelectProps) {
  // A controlled <select> only shows what's in its <option> list. If the lead's
  // assignee is NOT in the operator pool (e.g. a disabled/removed user), the
  // select would render blank and silently misreport "Sin asignar". Inject a
  // phantom option so the select ALWAYS reflects the real assignee.
  const assigneeInPool =
    lead.assigneeId != null && operators.some((op) => op.id === lead.assigneeId);
  const showPhantom = lead.assigneeId != null && !assigneeInPool;

  return (
    <select
      className={styles.assignSelect}
      aria-label={`Asignar lead ${lead.contactName}`}
      value={lead.assigneeId ?? ''}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const value = e.target.value;
        onAssign(lead.id, value === '' ? null : value);
      }}
    >
      <option value="">— Sin asignar —</option>
      {showPhantom && (
        <option value={lead.assigneeId!}>
          {lead.assigneeName ?? 'Asignado (fuera de lista)'}
        </option>
      )}
      {operators.map((op) => (
        <option key={op.id} value={op.id}>{op.name}</option>
      ))}
    </select>
  );
}

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

const ASSIGNEE_KEY = 'assigneeId';

// ── Component ────────────────────────────────────────────────────────────────

interface RecaptacionTableViewProps {
  leads: RecaptureLeadDto[];
  loading?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onRowClick?: (lead: RecaptureLeadDto) => void;
  /** Admin bulk-assign: when true, DataTable renders selection checkboxes. */
  selectable?: boolean;
  /** Controlled selection ids (lead ids). Owned by the page. */
  selectedIds?: string[];
  /** Reports the new selection back to the page. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Admin single-assign: when true, the "Asignado" column renders an editable
   *  <select> per row instead of read-only text. */
  canAssign?: boolean;
  /** Operator pool for the inline select (RbacUsers). */
  operators?: AssigneeOption[];
  /** Fired when the admin changes a row's inline assign select. null = unassign. */
  onAssign?: (leadId: string, operatorId: string | null) => void;
  /** Id of the lead whose inline assign is in flight — its select is disabled. */
  assigningId?: string | null;
}

export function RecaptacionTableView({
  leads,
  loading = false,
  hasActiveFilters = false,
  onClearFilters,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  canAssign = false,
  operators = [],
  onAssign,
  assigningId = null,
}: RecaptacionTableViewProps) {
  // Custom empty state so we can offer a "clear filters" CTA.
  if (!loading && leads.length === 0) {
    return (
      <div className={styles.empty} data-testid="recaptacion-empty-state">
        {hasActiveFilters ? (
          <>
            <p className={styles.emptyTitle}>Sin resultados para los filtros</p>
            <p className={styles.emptyHint}>Ajustá o limpiá los filtros para ver más leads.</p>
            <Button variant="primary" onClick={onClearFilters}>
              Limpiar filtros
            </Button>
          </>
        ) : canAssign ? (
          <>
            <p className={styles.emptyTitle}>No hay leads de recaptación</p>
            <p className={styles.emptyHint}>
              Ejecutá "Ingestar bajas" para cargar clientes dados de baja como leads.
            </p>
          </>
        ) : (
          // Agent (no recapture.assign): they cannot ingest, so the admin copy
          // is misleading. Address them directly.
          <>
            <p className={styles.emptyTitle}>Todavía no tenés leads asignados</p>
            <p className={styles.emptyHint}>
              El administrador todavía no te asignó leads de recaptación.
            </p>
          </>
        )}
      </div>
    );
  }

  // When admin can assign, swap the "Asignado" column for an inline editable
  // select. The select handles its own clicks (stopPropagation) so it is NOT
  // wrapped by the row-click handler below.
  const inlineAssign = canAssign && !!onAssign;
  const baseColumns = inlineAssign
    ? COLUMNS.map((col) =>
        col.key === ASSIGNEE_KEY
          ? {
              ...col,
              render: (row: RecaptureLeadDto) => (
                <InlineAssignSelect
                  lead={row}
                  operators={operators}
                  onAssign={onAssign!}
                  disabled={assigningId === row.id}
                />
              ),
            }
          : col,
      )
    : COLUMNS;

  // Wrap columns to inject the row-click handler via render if present. The
  // inline-assign column is left untouched so its select doesn't open the drawer.
  const columns = onRowClick
    ? baseColumns.map((col) =>
        inlineAssign && col.key === ASSIGNEE_KEY
          ? col
          : {
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
            },
      )
    : baseColumns;

  return (
    <div className={styles.wrapper}>
      <DataTable<RecaptureLeadDto>
        columns={columns}
        data={leads}
        loading={loading}
        emptyMessage="No hay leads."
        selectable={selectable}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        actions={
          onRowClick
            ? [{ label: 'Ver detalle', onClick: onRowClick }]
            : undefined
        }
      />
    </div>
  );
}
