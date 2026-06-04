import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useTicket,
  useTicketReplies,
  useUpdateTicketStatus,
  useAddTicketReply,
  useAssignTicket,
  useUpdateTicket,
  useDeleteTicket,
} from '../../hooks/useTickets';
import { useTicketStatuses } from '../../hooks/useTicketStatuses';
import { useRbacUsers } from '../../hooks/useRbacUsers';
import { useCan } from '../../hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { TicketHeader } from './TicketDetailPage/components/TicketHeader';
import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useCreateTaskFromTicket } from '@/hooks/useScheduling';
import styles from './TicketDetailPage.module.css';

const CLOSED_SLUGS = ['cerrado', 'closed'];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? '';
  const navigate = useNavigate();
  const confirm = useConfirm();

  const { data: ticket, isLoading: ticketLoading } = useTicket(ticketId);
  const { data: replies, isLoading: repliesLoading } = useTicketReplies(ticketId);
  const { data: catalogStatuses = [] } = useTicketStatuses();
  const updateStatus = useUpdateTicketStatus();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const addReply = useAddTicketReply();
  const assignTicket = useAssignTicket();
  const { data: allUsers = [] } = useRbacUsers();

  const canWrite = useCan('tickets.write');

  // CreateTask modal state (for the "Crear tarea" kebab item).
  const [showCreateTask, setShowCreateTask] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: templates = [] } = useTaskTemplates();
  const technicians = allUsers.filter(u => u.roles.some(r => r.code === 'tecnico'));
  const createTaskFromTicket = useCreateTaskFromTicket();

  const [replyText, setReplyText] = useState('');

  if (ticketLoading) {
    return <div className={styles.loading}>Cargando ticket...</div>;
  }

  if (!ticket) {
    return <div className={styles.notFound}>Ticket no encontrado.</div>;
  }

  // Subject inline edit → origin's updateTicket mutation.
  async function handleSubjectSave(subject: string) {
    await updateTicket.mutateAsync({ id: ticketId, data: { subject } });
  }

  // StatusSelect / kebab close → origin's updateStatus mutation.
  async function handleStatusChange(status: string) {
    await updateStatus.mutateAsync({ id: ticketId, status });
  }

  // "Cerrar ticket" kebab → move to the catalog's closed slug.
  async function handleClose() {
    const closed = catalogStatuses.find(s => CLOSED_SLUGS.includes(s.name.toLowerCase()));
    await updateStatus.mutateAsync({ id: ticketId, status: closed?.name ?? 'cerrado' });
  }

  async function handleDelete() {
    if (await confirm({ message: '¿Eliminar este ticket? Esta acción no se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' })) {
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

  const isSaving = updateStatus.isPending || updateTicket.isPending;

  return (
    <div className={styles.page}>
      <TicketHeader
        ticket={ticket}
        onSubjectSave={handleSubjectSave}
        onStatusChange={handleStatusChange}
        onClose={() => void handleClose()}
        onDelete={() => void handleDelete()}
        onCreateTask={() => setShowCreateTask(true)}
        isSaving={isSaving}
      />

      {/* 8fr / 4fr grid */}
      <div className={styles.grid}>
        {/* Main column — conversation + reply form */}
        <main className={styles.main}>
          <section className={styles.conversation}>
            <h2 className={styles.conversationTitle}>Conversación</h2>
            {repliesLoading ? (
              <p>Cargando respuestas...</p>
            ) : (replies ?? []).length === 0 ? (
              <p className={styles.emptyReplies}>Sin respuestas aún.</p>
            ) : (
              <ul className={styles.replyList}>
                {(replies ?? []).map(reply => (
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

          {canWrite && (
            <section className={styles.replyForm}>
              <h2 className={styles.replyFormTitle}>Responder</h2>
              <form onSubmit={handleSubmitReply}>
                <textarea
                  className={styles.textarea}
                  placeholder="Respuesta..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                />
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={addReply.isPending || !replyText.trim()}
                >
                  {addReply.isPending ? 'Enviando...' : 'Responder'}
                </button>
              </form>
            </section>
          )}
        </main>

        {/* Right sidebar — Detalles */}
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
              <span>{ticket.reporter ?? '—'}</span>
            </div>

            <div className={styles.sideRow}>
              <span className={styles.sideLabel}>Asignado a</span>
              <select
                value={ticket.assignedTo != null ? String(ticket.assignedTo) : ''}
                onChange={e => {
                  const val = e.target.value;
                  const user = allUsers.find(u => String(u.id) === val);
                  assignTicket.mutate({
                    id: ticketId,
                    assignedTo: user ? (Number(user.id) || null) : null,
                    assignedToName: user?.name ?? null,
                  });
                }}
                disabled={assignTicket.isPending}
                aria-label="Asignar a"
                className={styles.sideSelect}
              >
                <option value="">Sin asignar</option>
                {allUsers.map(u => (
                  <option key={u.id} value={String(u.id)}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.sideRow}>
              <span className={styles.sideLabel}>Prioridad</span>
              <span>{ticket.priority}</span>
            </div>

            <div className={styles.sideRow}>
              <span className={styles.sideLabel}>Creado</span>
              <span>{new Date(ticket.createdAt).toLocaleDateString('es-AR')}</span>
            </div>

            <div className={styles.sideRow}>
              <span className={styles.sideLabel}>Actualizado</span>
              <span>{new Date(ticket.updatedAt).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* CreateTaskModal — opened from the kebab "Crear tarea".
          Prefills soft fields from the ticket; the operator must still pick the
          required contract (origin's required-contract rule). ticketId is sent
          only when the BE supports it (graceful). */}
      {showCreateTask && (
        <CreateTaskModal
          projects={projects}
          workflows={workflows}
          technicians={technicians}
          templates={templates}
          onClose={() => setShowCreateTask(false)}
          onCreate={async data => {
            // #9: create via POST /tickets/:id/tasks so ticketId is persisted,
            // then redirect to the new task's detail page.
            const task = await createTaskFromTicket.mutateAsync({ ticketId: ticket.id, body: data });
            navigate(`/admin/scheduling/tasks/${task.id}`);
          }}
          loading={createTaskFromTicket.isPending}
          initialValues={{
            title: ticket.subject,
            customerId: ticket.customerId ? String(ticket.customerId) : undefined,
            customerName: ticket.customerName ?? undefined,
            description: ticket.message ?? undefined,
            ticketId: ticket.id,
          }}
        />
      )}
    </div>
  );
}
