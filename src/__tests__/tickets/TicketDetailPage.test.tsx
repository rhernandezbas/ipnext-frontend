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
import type { Ticket, TicketReply } from '@/types/ticket';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useRbacUsers');
// The "Crear tarea" path mounts CreateTaskModal lazily; stub the data hooks it
// (and the page) rely on so the detail page renders without real network.
// useProjects is a controllable mock so a test can inject network-tagged
// projects and assert they are filtered out of the create modal (#40 FIX-2).
const useProjectsMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => useProjectsMock() }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskTemplates', () => ({ useTaskTemplates: () => ({ data: [] }) }));
vi.mock('@/hooks/useScheduling', () => ({ useCreateTaskFromTicket: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTicket: Ticket = {
  id: 1,
  subject: 'Problema de conexión a internet',
  description: 'No tengo señal desde ayer.',
  status: 'open',
  priority: 'high',
  type: null,
  customerId: 42,
  customerName: 'Alice García',
  assigneeId: '5',
  assigneeName: 'Juan Técnico',
  reporter: null,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  resolvedAt: null,
  tags: [],
};

const mockReplies: TicketReply[] = [
  { id: 1, ticketId: 1, message: 'Estamos revisando el problema.', authorId: 1, authorName: 'Soporte Técnico', createdAt: '2024-01-15T11:00:00Z', isInternal: false },
  { id: 2, ticketId: 1, message: 'Enviamos un técnico a la zona.', authorId: 2, authorName: 'Admin', createdAt: '2024-01-15T12:00:00Z', isInternal: false },
];

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

function renderPage(ticketId = '1') {
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
    // clearAllMocks wipes the implementation — restore the empty-projects default.
    useProjectsMock.mockReturnValue({ data: [] });

    vi.mocked(useTicketsModule.useTicket).mockReturnValue({ data: mockTicket, isLoading: false } as ReturnType<typeof useTicketsModule.useTicket>);
    vi.mocked(useTicketsModule.useTicketReplies).mockReturnValue({ data: mockReplies, isLoading: false } as ReturnType<typeof useTicketsModule.useTicketReplies>);
    vi.mocked(useTicketsModule.useUpdateTicketStatus).mockReturnValue({ mutate: mockMutate, mutateAsync: mockMutateAsync, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useUpdateTicketStatus>);
    vi.mocked(useTicketsModule.useAddTicketReply).mockReturnValue({ mutate: mockMutate, isPending: false } as unknown as ReturnType<typeof useTicketsModule.useAddTicketReply>);
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
  });

  it('renders ticket subject in the header', () => {
    renderPage();
    // Subject is an editable h1 exposed as a button; assert by its text content.
    expect(screen.getByText('Problema de conexión a internet')).toBeInTheDocument();
  });

  it('renders the catalog-driven StatusSelect with the current status', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('open');
    expect(screen.getByRole('option', { name: 'closed' })).toBeInTheDocument();
  });

  it('changing the StatusSelect calls updateStatus mutation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /estado/i }), 'resolved');
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: '1', status: 'resolved' });
  });

  it('renders customerName in the Detalles sidebar', () => {
    renderPage();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
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

  it('changing the assignment select calls assignTicket with assigneeId', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), '6');
    expect(mockMutate).toHaveBeenCalledWith({ id: '1', assigneeId: '6' });
  });

  it('clearing the assignment select calls assignTicket with assigneeId null', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), '');
    expect(mockMutate).toHaveBeenCalledWith({ id: '1', assigneeId: null });
  });

  it('renders reply messages and authors in the conversation', () => {
    renderPage();
    expect(screen.getByText('Estamos revisando el problema.')).toBeInTheDocument();
    expect(screen.getByText('Enviamos un técnico a la zona.')).toBeInTheDocument();
    expect(screen.getByText('Soporte Técnico')).toBeInTheDocument();
  });

  it('the "Responder" button submits a reply via addReply mutation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText('Respuesta...'), 'Mi respuesta de prueba');
    await user.click(screen.getByRole('button', { name: 'Responder' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', message: 'Mi respuesta de prueba' }),
      expect.any(Object),
    );
  });

  it('inline subject edit calls updateTicket mutation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Asunto:/i }));
    const input = screen.getByRole('textbox', { name: /editar asunto/i });
    await user.clear(input);
    await user.type(input, 'Nuevo asunto');
    await user.tab(); // blur → commit
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: '1', data: { subject: 'Nuevo asunto' } }),
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
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: '1', status: 'closed' });
  });

  it('"Crear tarea" kebab opens the CreateTaskModal prefilled from the ticket', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await user.click(screen.getByRole('menuitem', { name: /crear tarea/i }));
    // Modal opened — its title input is seeded with the ticket subject.
    expect((await screen.findByPlaceholderText('Título de la tarea') as HTMLInputElement).value)
      .toBe('Problema de conexión a internet');
  });

  // ── #40 FIX-2: the ticket "Crear tarea" flow is a CUSTOMER flow. Network
  // projects must NOT reach the project <select> — the page filters them with
  // !isNetworkProject. A network project leaking through lets the operator
  // dispatch a create the backend rejects (422).
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

    // The customer project is offered; the network-tagged project is NOT.
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

  it('does NOT render the reply form when the user lacks tickets.write', () => {
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(false);
    renderPage();
    expect(screen.queryByPlaceholderText('Respuesta...')).not.toBeInTheDocument();
  });
});
