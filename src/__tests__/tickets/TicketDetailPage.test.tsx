import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketDetailPage from '@/pages/tickets/TicketDetailPage';
import * as useTicketsModule from '@/hooks/useTickets';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useAuthModule from '@/hooks/useAuth';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import type { Ticket } from '@/types/ticket';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useRbacUsers');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTicketComments');
// The "Crear tarea" path mounts CreateTaskModal lazily; stub the data hooks it
// (and the page) rely on so the detail page renders without real network.
const useProjectsMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => useProjectsMock() }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskTemplates', () => ({ useTaskTemplates: () => ({ data: [] }) }));
vi.mock('@/hooks/useScheduling', () => ({ useCreateTaskFromTicket: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTicket: Ticket = {
  id: 'abc-123',
  sequenceNumber: 7,
  subject: 'Problema de conexión a internet',
  description: 'No tengo señal desde ayer.',
  status: 'open',
  priority: 'high',
  type: null,
  customerId: '42',
  customerName: 'Alice García',
  assigneeId: '5',
  assigneeName: 'Juan Técnico',
  reporterId: '7',
  reporterName: 'María Creadora',
  reporter: null,
  tasks: [],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  resolvedAt: null,
  tags: [],
};

const mockStatuses = [
  { id: '1', name: 'open', color: '#22c55e', weight: 1 },
  { id: '2', name: 'pending', color: '#f59e0b', weight: 2 },
  { id: '3', name: 'resolved', color: '#3b82f6', weight: 3 },
  { id: '4', name: 'closed', color: '#6b7280', weight: 4 },
];

const mockRbacUsers = [
  { id: '5', name: 'Juan Técnico', roles: [{ code: 'tecnico' }] },
  { id: '6', name: 'Soporte', roles: [{ code: 'soporte' }] },
];

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

function renderPage(ticketId = 'abc-123') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[`/admin/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/admin/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/admin/tickets/opened" element={<div>Lista de Tickets</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketDetailPage (Prominense layout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectsMock.mockReturnValue({ data: [] });

    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: mockTicket, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>);
    vi.mocked(useTicketsModule.useUpdateTicketStatus).mockReturnValue({ mutate: mockMutate, mutateAsync: mockMutateAsync, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useUpdateTicketStatus>);
    vi.mocked(useTicketsModule.useAssignTicket).mockReturnValue({ mutate: mockMutate, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useAssignTicket>);
    vi.mocked(useTicketsModule.useUpdateTicket).mockReturnValue({ mutate: mockMutate, mutateAsync: mockMutateAsync, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useUpdateTicket>);
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({ mutate: mockMutate, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);

    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({ data: mockStatuses, isLoading: false } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({ data: mockRbacUsers } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['*'],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);

    // TicketCommentsTimeline (Conversación tab) deps.
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: { id: 1, username: 'admin', email: 'a@x.com', displayName: 'Admin', role: 'admin', permissions: [] },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
    vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
  });

  it('renders ticket subject in the header', () => {
    renderPage();
    expect(screen.getByText('Problema de conexión a internet')).toBeInTheDocument();
  });

  it('renders the three tabs with Conversación active by default', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Conversación' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Datos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Relacionado' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Conversación' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Datos tab shows the description', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Datos' }));
    expect(screen.getByText('No tengo señal desde ayer.')).toBeInTheDocument();
  });

  it('Datos tab shows "Sin descripción" placeholder when empty', async () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({
      data: { ...mockTicket, description: '' },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicket>);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Datos' }));
    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('Relacionado tab shows the empty copy when there are no linked tasks', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Relacionado' }));
    expect(screen.getByText('No hay tareas vinculadas a este ticket')).toBeInTheDocument();
  });

  it('Relacionado tab lists linked tasks with a link to their detail', async () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({
      data: { ...mockTicket, tasks: [{ id: 't-9', sequenceNumber: 9, title: 'Visita técnica' }] },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicket>);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Relacionado' }));
    const link = screen.getByRole('link', { name: /Visita técnica/i });
    expect(link).toHaveAttribute('href', '/admin/scheduling/tasks/t-9');
  });

  it('the reply form is gone (replaced by the comments composer)', () => {
    renderPage();
    expect(screen.queryByPlaceholderText('Respuesta...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument();
  });

  it('renders the catalog-driven StatusSelect with the current status', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('open');
  });

  // #48 — the header StatusSelect is now controlled by the page's local draft
  // state; changing it stages the value (no immediate mutation). Persistence
  // happens only through the unified GUARDAR button in the Detalles panel.
  it('changing the StatusSelect does NOT mutate immediately (staged for unified save)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /estado/i }), 'resolved');
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('renders customerName in the Detalles sidebar', () => {
    renderPage();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
  });

  // #48 — Reporter is a read-only display of the creator's name (reporterName).
  it('renders the reporter name (reporterName) in the Detalles sidebar', () => {
    renderPage();
    expect(screen.getByText('María Creadora')).toBeInTheDocument();
  });

  it('renders "—" for the reporter when reporterName is null', () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue(
      { data: { ...mockTicket, reporterName: null }, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>,
    );
    renderPage();
    const reporterRow = screen.getByText('Reporter').closest('div') as HTMLElement;
    expect(reporterRow.textContent).toContain('—');
  });

  it('renders the assignment select with Sin asignar + RBAC users', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /asignar a/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soporte' })).toBeInTheDocument();
  });

  // #28 follow-up: the select must bind the BE's `assigneeId` (string RbacUser
  // id) — the legacy contract read `assignedTo:number`, which never exists, so
  // the select always fell back to "Sin asignar".
  it('the assignment select reflects the current assignee', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /asignar a/i }) as HTMLSelectElement;
    expect(select.value).toBe('5');
  });

  // #48 — assignment no longer mutates on change; it stages into the draft.
  it('changing the assignment select does NOT mutate immediately (staged)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), '6');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // #48 — the unified GUARDAR persists assignee + status + priority in ONE
  // updateTicket call (PATCH /tickets/:id).
  it('GUARDAR persists assignee + status + priority in a single updateTicket call', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), '6');
    await user.selectOptions(screen.getByRole('combobox', { name: /estado/i }), 'pending');
    await user.selectOptions(screen.getByRole('combobox', { name: /prioridad/i }), 'low');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'abc-123',
        data: { assigneeId: '6', status: 'pending', priority: 'low' },
      }),
    );
  });

  it('GUARDAR is disabled when there are no pending changes', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('GUARDAR becomes enabled after a change is staged', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /prioridad/i }), 'low');
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  // #48 fix-wave (H1) — the draft must be keyed by ticket.id. The :id route does
  // NOT remount the component on back/forward; if ticket B happens to share A's
  // assignee/status/priority, the seed effect (keyed only on those values) would
  // not re-fire and A's STAGED-but-unsaved draft could be GUARDADO over B.
  it('re-seeds the draft when the ticket id changes even if the field values match', async () => {
    const user = userEvent.setup();

    const ticketA = { ...mockTicket, id: 'A-1', assigneeId: '5', status: 'open' as const, priority: 'high' as const };
    // Same assignee/status/priority as A, different id — the dangerous case.
    const ticketB = { ...mockTicket, id: 'B-2', assigneeId: '5', status: 'open' as const, priority: 'high' as const };

    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: ticketA, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>);
    const { rerender } = renderPage('A-1');

    // Stage a dirty draft on A (change the status away from 'open').
    await user.selectOptions(screen.getByRole('combobox', { name: /estado/i }), 'pending');
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();

    // Navigate to B WITHOUT remounting: same element, the mock now yields B.
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: ticketB, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>);
    rerender(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/admin/tickets/B-2']}>
          <Routes>
            <Route path="/admin/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/admin/tickets/opened" element={<div>Lista de Tickets</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // The draft must have reset to B's values → status select back to 'open',
    // GUARDAR disabled (isDirty=false). The dirty draft from A must NOT survive.
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
      expect(select.value).toBe('open');
    });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  // #48 fix-wave (M2) — a failed GUARDAR (e.g. 422 TICKET_STATUS_NOT_FOUND, part
  // of the contract) must surface a visible error, not vanish as an unhandled
  // rejection.
  it('shows a visible error when GUARDAR fails', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce({
      response: { data: { error: 'Status "ghost" is not in the ticket status catalog', code: 'TICKET_STATUS_NOT_FOUND' } },
    });
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /prioridad/i }), 'low');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/no se pudo|error|catalog/i);
  });

  it('inline subject edit calls updateTicket mutation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Asunto:/i }));
    const input = screen.getByRole('textbox', { name: /editar asunto/i });
    await user.clear(input);
    await user.type(input, 'Nuevo asunto');
    await user.tab();
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'abc-123', data: { subject: 'Nuevo asunto' } }),
    );
  });

  it('Acciones kebab exposes Cerrar / Crear tarea / Eliminar with full perms', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('menuitem', { name: /cerrar ticket/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /crear tarea/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('"Cerrar ticket" kebab moves the ticket to the closed catalog slug', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await user.click(screen.getByRole('menuitem', { name: /cerrar ticket/i }));
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'abc-123', status: 'closed' });
  });

  it('"Crear tarea" kebab opens the CreateTaskModal prefilled from the ticket', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await user.click(screen.getByRole('menuitem', { name: /crear tarea/i }));
    expect((await screen.findByPlaceholderText('Título de la tarea') as HTMLInputElement).value)
      .toBe('Problema de conexión a internet');
  });

  it('does NOT offer network projects in the create modal (regression #40)', async () => {
    const user = userEvent.setup();
    useProjectsMock.mockReturnValue({
      data: [
        { id: 'cp-1', title: 'INSTALACION', description: null, workflowId: 'wf-1', isNetworkProject: false, createdAt: '', updatedAt: '' },
        { id: 'np-1', title: 'RED - FIBRA', description: null, workflowId: 'wf-1', isNetworkProject: true, createdAt: '', updatedAt: '' },
      ],
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await user.click(screen.getByRole('menuitem', { name: /crear tarea/i }));
    await screen.findByPlaceholderText('Título de la tarea');

    expect(screen.getByRole('option', { name: 'INSTALACION' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'RED - FIBRA' })).not.toBeInTheDocument();
  });

  it('shows loading state while the ticket is loading', () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useTicketsModule.useTicket>);
    renderPage();
    expect(screen.getByText('Cargando ticket...')).toBeInTheDocument();
  });

  it('shows not-found when the ticket is undefined and not loading', () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>);
    renderPage();
    expect(screen.getByText('Ticket no encontrado.')).toBeInTheDocument();
  });
});
