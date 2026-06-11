import { Link } from 'react-router-dom';
import type { Ticket } from '@/types/ticket';
import styles from './TicketSidebar.module.css';

interface RbacUserLite {
  id: string;
  name: string;
}

interface TicketSidebarProps {
  ticket: Ticket;
  users: RbacUserLite[];
  onAssign: (assigneeId: string | null) => void;
  assignPending: boolean;
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

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export function TicketSidebar({ ticket, users, onAssign, assignPending }: TicketSidebarProps) {
  const priorityClass =
    styles[`priority${ticket.priority.charAt(0).toUpperCase()}${ticket.priority.slice(1)}`] ?? '';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Detalles</h3>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Estado</span>
          <span className={styles.statusBadge}>{ticket.status}</span>
        </div>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Prioridad</span>
          <span className={`${styles.priorityBadge} ${priorityClass}`}>
            {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
          </span>
        </div>

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
          <span>{ticket.reporter ?? '—'}</span>
        </div>

        <div className={styles.sideRow}>
          <span className={styles.sideLabel}>Asignado a</span>
          <select
            value={ticket.assigneeId ?? ''}
            onChange={(e) => onAssign(e.target.value || null)}
            disabled={assignPending}
            aria-label="Asignar a"
            className={styles.sideSelect}
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>{u.name}</option>
            ))}
          </select>
        </div>

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
      </div>
    </aside>
  );
}
