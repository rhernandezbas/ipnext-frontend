import { Link } from 'react-router-dom';
import type { Ticket } from '@/types/ticket';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { useClientContracts } from '@/hooks/useCustomers';
import { buildContractLabel } from '@/lib/buildContractLabel';
import { Button } from '@/components/atoms/Button';
import { formatRelative } from '@/utils/formatDate';
import styles from './TicketSidebar.module.css';

interface RbacUserLite {
  id: string;
  name: string;
}

interface TicketSidebarProps {
  ticket: Ticket;
  users: RbacUserLite[];
  /** #48 — controlled draft values owned by the page (unified save). */
  draftAssigneeId: string;
  draftPriority: string;
  /** #49 — draft area id (string to set, '' to clear). */
  draftAreaId: string;
  onAssigneeChange: (assigneeId: string) => void;
  onPriorityChange: (priority: string) => void;
  /** #49 — fires when the area select changes. */
  onAreaChange: (areaId: string) => void;
  /** #48 — persists assignee + status + priority in one PATCH. */
  onSaveDetails: () => void;
  isDirty: boolean;
  isSaving: boolean;
}

// #48 — priority options for the unified Detalles form. The BE accepts
// low/medium/high; 'critical' is kept for forward-compat with the FE type.
const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
];

export function TicketSidebar({
  ticket,
  users,
  draftAssigneeId,
  draftPriority,
  draftAreaId,
  onAssigneeChange,
  onPriorityChange,
  onAreaChange,
  onSaveDetails,
  isDirty,
  isSaving,
}: TicketSidebarProps) {
  const { can } = useMyPermissions();
  const canWrite = can(['tickets.write'], 'any');
  const { data: areas = [] } = useTicketAreas();

  // Contrato — el contrato del ticket ahora es obligatorio. Resolvemos su label
  // desde la lista de contratos del cliente (mismo hook que usan CreateTicket /
  // CreateTask), encontrando el que matchea ticket.contractId.
  const hasCustomer = !!ticket.customerId;
  const { data: contracts, isLoading: contractsLoading } = useClientContracts(
    ticket.customerId,
    hasCustomer,
  );
  const resolvedContract =
    ticket.contractId && contracts
      ? contracts.find((c) => String(c.id) === ticket.contractId) ?? null
      : null;
  const customerHref = ticket.customerId
    ? `/admin/customers/view/${ticket.customerId}`
    : null;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Detalles</h3>

        {/* ── Grupo: contexto del ticket (lectura) ───────────────────────── */}
        <div className={styles.group}>
          <div className={styles.sideRow}>
            <span className={styles.sideLabel}>Cliente</span>
            {customerHref ? (
              <Link to={customerHref} className={styles.sideLink}>
                {ticket.customerName}
              </Link>
            ) : (
              <span className={styles.sideValue}>{ticket.customerName ?? '—'}</span>
            )}
          </div>

          {/* Contrato — fila nueva, justo después de Cliente. */}
          <div className={styles.sideRow}>
            <span className={styles.sideLabel}>Contrato</span>
            <ContractValue
              hasCustomer={hasCustomer}
              contractId={ticket.contractId}
              loading={contractsLoading}
              contract={resolvedContract}
              customerHref={customerHref}
            />
          </div>

          <div className={styles.sideRow}>
            <span className={styles.sideLabel}>Reporter</span>
            {/* #48 — read-only display of who created the ticket (reporterName). */}
            <span className={styles.sideValue}>{ticket.reporterName ?? '—'}</span>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* ── Grupo: campos editables (draft + GUARDAR unificado) ─────────── */}
        <div className={styles.group}>
          {/* #48 — Asignado / Prioridad edit the page draft; the header edits the
              same draft's status. A single GUARDAR below persists them in one PATCH. */}
          <div className={styles.sideRow}>
            <label className={styles.sideLabel} htmlFor="ticket-assignee">Asignado a</label>
            <select
              id="ticket-assignee"
              value={draftAssigneeId}
              onChange={(e) => onAssigneeChange(e.target.value)}
              disabled={!canWrite || isSaving}
              aria-label="Asignar a"
              className={styles.sideSelect}
            >
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* #48 — Estado se edita desde el select prominente del header
              (TicketHeader), que escribe el mismo draft; el GUARDAR de acá lo
              persiste junto con asignado + prioridad en un solo PATCH. */}

          <div className={styles.sideRow}>
            <label className={styles.sideLabel} htmlFor="ticket-priority">Prioridad</label>
            <select
              id="ticket-priority"
              value={draftPriority}
              onChange={(e) => onPriorityChange(e.target.value)}
              disabled={!canWrite || isSaving}
              aria-label="Prioridad"
              className={styles.sideSelect}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* #49 — Area: edita el draft junto con asignado + prioridad; el GUARDAR lo persiste. */}
          <div className={styles.sideRow}>
            <label className={styles.sideLabel} htmlFor="ticket-area">Area</label>
            <select
              id="ticket-area"
              value={draftAreaId}
              onChange={(e) => onAreaChange(e.target.value)}
              disabled={!canWrite || isSaving}
              aria-label="Area"
              className={styles.sideSelect}
            >
              <option value="">Sin area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* ── Grupo: timestamps (lectura) ─────────────────────────────────── */}
        <div className={styles.group}>
          <div className={styles.sideRow}>
            <span className={styles.sideLabel}>Creado</span>
            <span className={styles.sideValue} title={new Date(ticket.createdAt).toLocaleString('es-AR')}>
              {formatRelative(ticket.createdAt)}
            </span>
          </div>

          <div className={styles.sideRow}>
            <span className={styles.sideLabel}>Actualizado</span>
            <span className={styles.sideValue} title={new Date(ticket.updatedAt).toLocaleString('es-AR')}>
              {formatRelative(ticket.updatedAt)}
            </span>
          </div>
        </div>

        {canWrite && (
          <div className={styles.sideActions}>
            <Button
              type="button"
              variant="primary"
              size="md"
              className={styles.saveBtn}
              onClick={onSaveDetails}
              disabled={!isDirty}
              loading={isSaving}
              aria-label={isSaving ? 'Guardando cambios' : 'Guardar cambios'}
            >
              Guardar
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Contract value — loading / found / fallback / empty states ──────────────

interface ContractValueProps {
  hasCustomer: boolean;
  contractId: string | null;
  loading: boolean;
  contract: { id: string | number; plan: string; address?: string | null; technology?: string | null; code?: string | null } | null;
  customerHref: string | null;
}

function ContractValue({ hasCustomer, contractId, loading, contract, customerHref }: ContractValueProps) {
  // Sin contrato asociado al ticket.
  if (!contractId) {
    return <span className={styles.sideValue}>—</span>;
  }
  // Cargando la lista de contratos del cliente.
  if (hasCustomer && loading) {
    return <span className={styles.sideMuted}>Cargando…</span>;
  }
  // Contrato encontrado → label legible + link al detalle del cliente.
  if (contract) {
    const label = buildContractLabel(contract);
    return customerHref ? (
      <Link to={customerHref} className={styles.sideLink} title={label}>
        {label}
      </Link>
    ) : (
      <span className={styles.sideValue} title={label}>{label}</span>
    );
  }
  // No se encontró el contrato (ej. de baja / no listado): fallback al code o #id.
  const fallback = `Contrato #${contractId}`;
  return <span className={styles.sideValue} title={fallback}>{fallback}</span>;
}
