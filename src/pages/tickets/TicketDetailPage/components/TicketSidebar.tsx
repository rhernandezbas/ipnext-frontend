import { Link } from 'react-router-dom';
import type { Ticket } from '@/types/ticket';
import { useMyPermissions } from '@/hooks/useMyPermissions';
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
  onAssigneeChange: (assigneeId: string) => void;
  onPriorityChange: (priority: string) => void;
  /** #48 — persists assignee + status + priority in one PATCH. */
  onSaveDetails: () => void;
  isDirty: boolean;
  isSaving: boolean;
}

/** Relative date in es-AR ("hace 3 días"), falling back to an absolute date. */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(-diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day');
  return new Date(iso).toLocaleDateString('es-AR');
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
  onAssigneeChange,
  onPriorityChange,
  onSaveDetails,
  isDirty,
  isSaving,
}: TicketSidebarProps) {
  const { can } = useMyPermissions();
  const canWrite = can(['tickets.write'], 'any');

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Detalles</h3>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Cliente</span>
          {ticket.customerId ? (
            <Link to={`/admin/clients/${ticket.customerId}`} className={styles.sideLink}>
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

        {/* #49 (futuro): el campo "Área" va acá, sumándose al draft + GUARDAR. */}

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Creado</span>
          <span title={new Date(ticket.createdAt).toLocaleString('es-AR')}>
            {relativeDate(ticket.createdAt)}
          </span>
        </div>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Actualizado</span>
          <span title={new Date(ticket.updatedAt).toLocaleString('es-AR')}>
            {relativeDate(ticket.updatedAt)}
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
