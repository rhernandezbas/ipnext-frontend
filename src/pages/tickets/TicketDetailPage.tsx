import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useTicket,
  useUpdateTicketStatus,
  useUpdateTicket,
  useDeleteTicket,
} from '../../hooks/useTickets';
import type { UpdateTicketData } from '../../hooks/useTickets';
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
  const { data: allUsers = [] } = useRbacUsers();

  // CreateTask modal state (for the "Crear tarea" kebab item).
  const [showCreateTask, setShowCreateTask] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: templates = [] } = useTaskTemplates();
  const technicians = allUsers.filter(u => u.roles.some(r => r.code === 'tecnico'));
  const createTaskFromTicket = useCreateTaskFromTicket();

  // #48 — Unified save: the Detalles panel (assignee + priority, plus a future
  // "área" slot for #49) and the header StatusSelect all edit a local DRAFT; a
  // single GUARDAR persists everything in ONE PATCH /tickets/:id. No more
  // per-field immediate mutation.
  const [draftAssigneeId, setDraftAssigneeId] = useState<string>('');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftPriority, setDraftPriority] = useState<string>('');
  // #48 (M2) — visible feedback when the unified GUARDAR fails (e.g. the 422
  // TICKET_STATUS_NOT_FOUND from the contract). Null = no error shown.
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the draft from the loaded ticket. CRITICAL (#48 H1): key the re-seed on
  // ticket.id too — the :id route does NOT remount on back/forward, so if the
  // next ticket happens to share this one's assignee/status/priority the effect
  // would not re-fire and a stale, dirty draft could be GUARDADO over the wrong
  // ticket. Including ticket.id resets the draft whenever the ticket changes.
  useEffect(() => {
    if (!ticket) return;
    setDraftAssigneeId(ticket.assigneeId ?? '');
    setDraftStatus(ticket.status);
    setDraftPriority(ticket.priority);
    setSaveError(null);
  }, [ticket?.id, ticket?.assigneeId, ticket?.status, ticket?.priority]);

  const isDirty = !!ticket && (
    draftAssigneeId !== (ticket.assigneeId ?? '') ||
    draftStatus !== ticket.status ||
    draftPriority !== ticket.priority
  );

  // Warn before leaving with unsaved draft changes (mirror of scheduling detail).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (ticketLoading) {
    return <div className={styles.loading}>Cargando ticket...</div>;
  }

  if (!ticket) {
    return <div className={styles.notFound}>Ticket no encontrado.</div>;
  }

  // Subject inline edit → updateTicket mutation.
  async function handleSubjectSave(subject: string) {
    await updateTicket.mutateAsync({ id: ticketId, data: { subject } });
  }

  // #48 — Unified save of the Detalles panel: ONE PATCH with assignee + status +
  // priority. assigneeId null clears the assignment.
  async function handleSaveDetails() {
    if (!ticket || !isDirty) return;
    const data: UpdateTicketData = {
      assigneeId: draftAssigneeId || null,
      status: draftStatus,
      priority: draftPriority,
    };
    // #48 (M2) — surface a visible error instead of leaking an unhandled
    // rejection. The 422 (TICKET_STATUS_NOT_FOUND) is part of the contract.
    setSaveError(null);
    try {
      await updateTicket.mutateAsync({ id: ticketId, data });
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; code?: string } } };
      const msg = e?.response?.data?.error;
      setSaveError(msg ?? 'No se pudieron guardar los cambios. Intentalo de nuevo.');
    }
  }

  // #48 — the header StatusSelect now stages into the draft (no immediate save).
  function handleStatusChange(status: string) {
    setDraftStatus(status);
  }

  // "Cerrar ticket" kebab → explicit immediate action via the status route.
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
        statusValue={draftStatus}
        onSubjectSave={handleSubjectSave}
        onStatusChange={handleStatusChange}
        onClose={() => void handleClose()}
        onDelete={() => void handleDelete()}
        onCreateTask={() => setShowCreateTask(true)}
        isSaving={isSaving}
      />

      {/* #48 (M2) — visible save error (e.g. 422 TICKET_STATUS_NOT_FOUND). */}
      {saveError && (
        <div className={styles.saveError} role="alert" aria-live="assertive">
          {saveError}
        </div>
      )}

      {/* 8fr / 4fr grid — tabs on the left, sticky details sidebar on the right. */}
      <div className={styles.grid}>
        <main className={styles.main}>
          <TicketTabs
            ticketId={ticket.id}
            description={ticket.description}
            tasks={ticket.tasks}
          />
        </main>

        {/* #48 — the sidebar edits assignee + priority into the page draft; the
            unified GUARDAR persists them (with the header status) in one PATCH. */}
        <TicketSidebar
          ticket={ticket}
          users={allUsers.map(u => ({ id: String(u.id), name: u.name }))}
          draftAssigneeId={draftAssigneeId}
          draftPriority={draftPriority}
          onAssigneeChange={setDraftAssigneeId}
          onPriorityChange={setDraftPriority}
          onSaveDetails={() => void handleSaveDetails()}
          isDirty={isDirty}
          isSaving={isSaving}
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
