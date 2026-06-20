import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Ticket } from '@/types/ticket';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import styles from './TicketHeader.module.css';

const CLOSED_SLUGS = ['cerrado', 'closed'];

interface TicketHeaderProps {
  ticket: Ticket;
  /** #48 — the draft status from the page (unified save). Controls the select. */
  statusValue: string;
  onSubjectSave: (subject: string) => Promise<void>;
  /** #48 — stages the status into the page draft (no immediate persistence). */
  onStatusChange: (status: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onCreateTask: () => void;
  isSaving: boolean;
}

export function TicketHeader({
  ticket,
  statusValue,
  onSubjectSave,
  onStatusChange,
  onClose,
  onDelete,
  onCreateTask,
  isSaving,
}: TicketHeaderProps) {
  const navigate = useNavigate();
  const { data: statuses = [] } = useTicketStatuses();
  const { can } = useMyPermissions();

  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectValue, setSubjectValue] = useState(ticket.subject);
  const [kebabOpen, setKebabOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  // Sync subject if ticket changes externally
  useEffect(() => {
    if (!editingSubject) setSubjectValue(ticket.subject);
  }, [ticket.subject, editingSubject]);

  useEffect(() => {
    if (editingSubject && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSubject]);

  // Close kebab on outside click
  useEffect(() => {
    if (!kebabOpen) return;
    const handler = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.closest('[data-kebab-wrapper]')?.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kebabOpen]);

  const commitSubject = async () => {
    const trimmed = subjectValue.trim();
    if (!trimmed || trimmed === ticket.subject) {
      setSubjectValue(ticket.subject);
      setEditingSubject(false);
      return;
    }
    try {
      await onSubjectSave(trimmed);
    } finally {
      setEditingSubject(false);
    }
  };

  const isClosedStatus = CLOSED_SLUGS.includes(ticket.status?.toLowerCase() ?? '');

  // Permission checks — dot-format.
  const canClose      = can(['tickets.close'], 'any');
  const canCreateTask = can(['scheduling.write'], 'any');
  const canDelete     = can(['tickets.delete'], 'any');
  const canWrite      = can(['tickets.write'], 'any');
  // Reopening a CLOSED ticket needs tickets.reopen (origin rule preserved).
  const canReopen     = can(['tickets.reopen'], 'any');

  /** A status option is selectable only when it is allowed for the current
   *  ticket. When the ticket is currently closed, moving to any non-closed
   *  status is a "reopen" and requires tickets.reopen. */
  function isStatusOptionDisabled(slug: string): boolean {
    const targetIsClosed = CLOSED_SLUGS.includes(slug.toLowerCase());
    if (isClosedStatus && !targetIsClosed && !canReopen) return true;
    return false;
  }

  return (
    <header className={styles.header}>
      <div className={styles.breadcrumbs}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/admin/tickets/opened')}
          aria-label="Volver a Tickets"
        >
          ◀
        </button>
        <span className={styles.breadcrumbText}>Soporte / Tickets / #{ticket.sequenceNumber}</span>
      </div>

      <div className={styles.titleRow}>
        {editingSubject ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={subjectValue}
            onChange={e => setSubjectValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void commitSubject();
              else if (e.key === 'Escape') { setSubjectValue(ticket.subject); setEditingSubject(false); }
            }}
            onBlur={() => void commitSubject()}
            aria-label="Editar asunto"
            disabled={isSaving}
          />
        ) : (
          <h1
            className={styles.title}
            onClick={() => { if (canWrite) setEditingSubject(true); }}
            role={canWrite ? 'button' : undefined}
            tabIndex={canWrite ? 0 : undefined}
            onKeyDown={e => { if (canWrite && (e.key === 'Enter' || e.key === ' ')) setEditingSubject(true); }}
            aria-label={`Asunto: ${ticket.subject}${canWrite ? '. Haz clic para editar' : ''}`}
          >
            {ticket.subject}
          </h1>
        )}

        <div className={styles.controls}>
          {/* StatusSelect — catalog-driven. #48: controlled by the page draft;
              staging only — persistence is the unified GUARDAR. */}
          <select
            value={statusValue}
            onChange={e => onStatusChange(e.target.value)}
            className={styles.statusSelect}
            disabled={isSaving || !canWrite}
            aria-label="Estado"
          >
            {statuses.map(s => (
              <option key={s.id} value={s.name} disabled={isStatusOptionDisabled(s.name)}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Kebab "Acciones" */}
          <div className={styles.kebabWrapper} data-kebab-wrapper="">
            <button
              ref={kebabRef}
              className={styles.kebabBtn}
              onClick={() => setKebabOpen(o => !o)}
              aria-label="Acciones"
              aria-haspopup="menu"
              aria-expanded={kebabOpen}
              data-testid="kebab-menu"
            >
              ⋮
            </button>
            {kebabOpen && (
            <ul className={styles.kebabMenu} role="menu">
              {canClose && !isClosedStatus && (
                <li>
                  <button
                    role="menuitem"
                    className={styles.kebabItem}
                    onClick={() => { setKebabOpen(false); onClose(); }}
                    data-testid="kebab-close"
                  >
                    Cerrar ticket
                  </button>
                </li>
              )}
              {canCreateTask && (
                <li>
                  <button
                    role="menuitem"
                    className={styles.kebabItem}
                    onClick={() => { setKebabOpen(false); onCreateTask(); }}
                    data-testid="kebab-create-task"
                  >
                    Crear tarea
                  </button>
                </li>
              )}
              {canDelete && (
                <li>
                  <button
                    role="menuitem"
                    className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                    onClick={() => { setKebabOpen(false); onDelete(); }}
                    data-testid="kebab-delete"
                  >
                    Eliminar
                  </button>
                </li>
              )}
            </ul>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
