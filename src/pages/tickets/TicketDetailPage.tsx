import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useTicket,
  useUpdateTicketStatus,
  useAssignTicket,
  useUpdateTicket,
  useDeleteTicket,
} from '../../hooks/useTickets';
import { useTicketStatuses } from '../../hooks/useTicketStatuses';
import { useRbacUsers } from '../../hooks/useRbacUsers';
import { useConfirm } from '@/context/ConfirmContext';
import { TicketHeader } from './TicketDetailPage/components/TicketHeader';
import { TicketTabs } from './TicketDetailPage/components/TicketTabs';
import { TicketSidebar } from './TicketDetailPage/components/TicketSidebar';
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
  const { data: catalogStatuses = [] } = useTicketStatuses();
  const updateStatus = useUpdateTicketStatus();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const assignTicket = useAssignTicket();
  const { data: allUsers = [] } = useRbacUsers();

  // CreateTask modal state (for the "Crear tarea" kebab item).
  const [showCreateTask, setShowCreateTask] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: templates = [] } = useTaskTemplates();
  const technicians = allUsers.filter(u => u.roles.some(r => r.code === 'tecnico'));
  const createTaskFromTicket = useCreateTaskFromTicket();

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

      {/* 8fr / 4fr grid — tabs on the left, sticky details sidebar on the right. */}
      <div className={styles.grid}>
        <main className={styles.main}>
          <TicketTabs
            ticketId={ticket.id}
            description={ticket.description}
            tasks={ticket.tasks}
          />
        </main>

        <TicketSidebar
          ticket={ticket}
          users={allUsers.map(u => ({ id: String(u.id), name: u.name }))}
          onAssign={(assigneeId) => assignTicket.mutate({ id: ticketId, assigneeId })}
          assignPending={assignTicket.isPending}
        />
      </div>

      {/* CreateTaskModal — opened from the kebab "Crear tarea".
          Prefills soft fields from the ticket; the operator must still pick the
          required contract (origin's required-contract rule). */}
      {showCreateTask && (
        <CreateTaskModal
          projects={projects.filter(p => !p.isNetworkProject)}
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
            description: ticket.description ?? undefined,
            ticketId: ticket.id,
          }}
        />
      )}
    </div>
  );
}
