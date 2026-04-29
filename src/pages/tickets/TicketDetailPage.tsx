import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTicket, useTicketReplies, useUpdateTicketStatus, useAddTicketReply, useAssignTicket, useUpdateTicket, useDeleteTicket } from '../../hooks/useTickets';
import type { TicketStatus } from '../../types/ticket';
import styles from './TicketDetailPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  pending: 'Pendiente',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

const STATUS_BUTTONS: Array<{ value: TicketStatus; label: string }> = [
  { value: 'open', label: 'Abrir' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'resolved', label: 'Resolver' },
  { value: 'closed', label: 'Cerrar' },
];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? '';
  const navigate = useNavigate();

  const { data: ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { data: replies, isLoading: repliesLoading } = useTicketReplies(ticketId);
  const updateStatus = useUpdateTicketStatus();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const addReply = useAddTicketReply();
  const assignTicket = useAssignTicket();

  const [replyText, setReplyText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editPriority, setEditPriority] = useState('');

  if (ticketLoading) {
    return <div className={styles.loading}>Cargando ticket...</div>;
  }

  if (!ticket) {
    return <div className={styles.notFound}>Ticket no encontrado.</div>;
  }

  function handleStatusChange(status: TicketStatus) {
    updateStatus.mutate({ id: ticketId, status });
  }

  function handleEditStart() {
    setEditSubject(ticket?.subject ?? '');
    setEditPriority(ticket?.priority ?? '');
    setEditMode(true);
  }

  function handleEditSave() {
    updateTicket.mutate(
      { id: ticketId, data: { subject: editSubject, priority: editPriority } },
      { onSuccess: () => setEditMode(false) }
    );
  }

  function handleDeleteTicket() {
    if (window.confirm('¿Eliminar este ticket? Esta acción no se puede deshacer.')) {
      deleteTicket.mutate(ticketId, { onSuccess: () => navigate('/admin/tickets/opened') });
    }
  }

  function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    addReply.mutate(
      { id: ticketId, message: replyText },
      { onSuccess: () => setReplyText('') }
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/admin/tickets/opened" className={styles.backLink}>
        ← Volver a tickets
      </Link>

      <div className={styles.header}>
        {editMode ? (
          <>
            <input
              className={styles.subjectInput}
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              aria-label="Asunto"
            />
            <select
              className={styles.prioritySelect}
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              aria-label="Prioridad"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
            <button className={styles.saveBtn} onClick={handleEditSave} disabled={updateTicket.isPending}>
              Guardar cambios
            </button>
            <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <h1 className={styles.subject}>{ticket.subject}</h1>
            <div className={styles.badges}>
              <span className={`${styles.badge} ${styles[`status_${ticket.status}`]}`}>
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>
              <span className={`${styles.badge} ${styles[`priority_${ticket.priority}`]}`}>
                {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              </span>
            </div>
            <button className={styles.editBtn} onClick={handleEditStart}>
              Editar
            </button>
          </>
        )}
      </div>

      <div className={styles.metadata}>
        <span>Creado por: <strong>{ticket.customerName}</strong></span>
        <span>
          Asignado a:{' '}
          <select
            value={ticket.assignedTo ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              const options: Record<string, { id: number | null; name: string | null }> = {
                '': { id: null, name: null },
                '1': { id: 1, name: 'Admin Principal' },
                '2': { id: 2, name: 'Soporte' },
                '3': { id: 3, name: 'Técnico' },
              };
              const selected = options[val];
              if (selected !== undefined) {
                assignTicket.mutate({ id: ticketId, assignedTo: selected.id, assignedToName: selected.name });
              }
            }}
            disabled={assignTicket.isPending}
            aria-label="Asignar a"
          >
            <option value="">Sin asignar</option>
            <option value="1">Admin Principal (1)</option>
            <option value="2">Soporte (2)</option>
            <option value="3">Técnico (3)</option>
          </select>
        </span>
        <span>Creado: <strong>{new Date(ticket.createdAt).toLocaleDateString('es-AR')}</strong></span>
      </div>

      <div className={styles.statusActions}>
        {STATUS_BUTTONS.map(({ value, label }) => (
          <button
            key={value}
            className={`${styles.statusBtn} ${ticket.status === value ? styles.statusBtnActive : ''}`}
            onClick={() => handleStatusChange(value)}
            disabled={updateStatus.isPending}
          >
            {label}
          </button>
        ))}
        <button
          className={styles.deleteBtn}
          onClick={handleDeleteTicket}
          disabled={deleteTicket.isPending}
        >
          Eliminar ticket
        </button>
      </div>

      <section className={styles.conversation}>
        <h2 className={styles.conversationTitle}>Conversación</h2>
        {repliesLoading ? (
          <p>Cargando respuestas...</p>
        ) : (replies ?? []).length === 0 ? (
          <p className={styles.emptyReplies}>Sin respuestas aún.</p>
        ) : (
          <ul className={styles.replyList}>
            {(replies ?? []).map((reply) => (
              <li key={reply.id} className={`${styles.replyCard} ${reply.isInternal ? styles.replyInternal : ''}`}>
                <div className={styles.replyHeader}>
                  <strong>{reply.authorName}</strong>
                  <span className={styles.replyDate}>
                    {new Date(reply.createdAt).toLocaleString('es-AR')}
                  </span>
                  {reply.isInternal && <span className={styles.internalTag}>Interno</span>}
                </div>
                <p className={styles.replyMessage}>{reply.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.replyForm}>
        <h2 className={styles.replyFormTitle}>Responder</h2>
        <form onSubmit={handleSubmitReply}>
          <textarea
            className={styles.textarea}
            placeholder="Respuesta..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
          />
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={addReply.isPending || !replyText.trim()}
          >
            {addReply.isPending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </section>
    </div>
  );
}
