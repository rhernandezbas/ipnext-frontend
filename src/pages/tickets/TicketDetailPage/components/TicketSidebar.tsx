import { Link } from 'react-router-dom';
import type { Ticket } from '@/types/ticket';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTicketAreas } from '@/hooks/useTicketAreas';
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

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Detalles</h3>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Cliente</span>
          {ticket.customerId ? (
            <Link to={`/admin/customers/view/${ticket.customerId}`} className={styles.sideLink}>
              {ticket.customerName}
            </Link>
          ) : (
            <span>{ticket.customerName ?? '—'}</span>
          )}
        </div>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Reporter</span>
          {/* #48 — read-only display of who created the ticket (reporterName). */}
          <span>{ticket.reporterName ?? '—'}</span>
        </div>

        {/* #48 — Asignado / Prioridad edit the page draft; the header edits the
            same draft's status. A single GUARDAR below persists them in one PATCH. */}
        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Asignado a</span>
          <select
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
          <span className={styles.sideLabel}>Prioridad</span>
          <select
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
          <span className={styles.sideLabel}>Area</span>
          <select
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

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Creado</span>
          <span title={new Date(ticket.createdAt).toLocaleString('es-AR')}>
            {formatRelative(ticket.createdAt)}
          </span>
        </div>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Actualizado</span>
          <span title={new Date(ticket.updatedAt).toLocaleString('es-AR')}>
            {formatRelative(ticket.updatedAt)}
          </span>
        </div>

        {canWrite && (
          <div className={styles.sideActions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={onSaveDetails}
              disabled={!isDirty || isSaving}
              aria-label={isSaving ? 'Guardando cambios' : 'Guardar cambios'}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
