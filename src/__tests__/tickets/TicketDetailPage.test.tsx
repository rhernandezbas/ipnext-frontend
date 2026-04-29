import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketDetailPage from '@/pages/tickets/TicketDetailPage';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Ticket, TicketReply } from '@/types/ticket';

vi.mock('@/hooks/useTickets');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTicket: Ticket = {
  id: 1,
  subject: 'Problema de conexión a internet',
  message: 'No tengo señal desde ayer.',
  status: 'open',
  priority: 'high',
  type: null,
  customerId: 42,
  customerName: 'Alice García',
  assignedTo: 5,
  assignedToName: 'Juan Técnico',
  reporter: null,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  resolvedAt: null,
  tags: [],
};

const mockReplies: TicketReply[] = [
  {
    id: 1,
    ticketId: 1,
    message: 'Estamos revisando el problema.',
    authorId: 1,
    authorName: 'Soporte Técnico',
    createdAt: '2024-01-15T11:00:00Z',
    isInternal: false,
  },
  {
    id: 2,
    ticketId: 1,
    message: 'Enviamos un técnico a la zona.',
    authorId: 2,
    authorName: 'Admin',
    createdAt: '2024-01-15T12:00:00Z',
    isInternal: false,
  },
];

const mockMutate = vi.fn();

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

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTicketsModule.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicket>);

    vi.mocked(useTicketsModule.useTicketReplies).mockReturnValue({
      data: mockReplies,
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicketReplies>);

    vi.mocked(useTicketsModule.useUpdateTicketStatus).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useUpdateTicketStatus>);

    vi.mocked(useTicketsModule.useAddTicketReply).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useAddTicketReply>);

    vi.mocked(useTicketsModule.useAssignTicket).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useAssignTicket>);

    vi.mocked(useTicketsModule.useUpdateTicket).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useUpdateTicket>);

    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);
  });

  it('renders ticket subject as heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Problema de conexión a internet' })).toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderPage();
    // "Abierto" badge (status: open)
    expect(screen.getByText('Abierto')).toBeInTheDocument();
  });

  it('renders customerName in metadata', () => {
    renderPage();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
  });

  it('renders assignment select in metadata', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeInTheDocument();
  });

  it('renders reply messages in conversation thread', () => {
    renderPage();
    expect(screen.getByText('Estamos revisando el problema.')).toBeInTheDocument();
    expect(screen.getByText('Enviamos un técnico a la zona.')).toBeInTheDocument();
  });

  it('renders reply author names', () => {
    renderPage();
    expect(screen.getByText('Soporte Técnico')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('"Enviar" button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('"Enviar" button submits reply', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText('Respuesta...');
    await user.type(textarea, 'Mi respuesta de prueba');

    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', message: 'Mi respuesta de prueba' }),
      expect.any(Object),
    );
  });

  it('status change buttons are present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pendiente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('clicking a status button calls updateStatus mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resolver' }));

    expect(mockMutate).toHaveBeenCalledWith({ id: '1', status: 'resolved' });
  });

  it('renders back link to /admin/tickets/opened', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /Volver a tickets/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tickets/opened');
  });

  it('shows loading state while ticket is loading', () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketsModule.useTicket>);

    renderPage();
    expect(screen.getByText('Cargando ticket...')).toBeInTheDocument();
  });

  it('shows not found when ticket is undefined and not loading', () => {
    vi.mocked(useTicketsModule.useTicket).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicket>);

    renderPage();
    expect(screen.getByText('Ticket no encontrado.')).toBeInTheDocument();
  });

  it('navigates to list on back link click', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('link', { name: /Volver a tickets/i }));

    await waitFor(() => {
      expect(screen.getByText('Lista de Tickets')).toBeInTheDocument();
    });
  });

  it('renders assignment select/dropdown', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeInTheDocument();
  });

  it('assignment select has options including Sin asignar', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /asignar a/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Admin Principal (1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soporte (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Técnico (3)' })).toBeInTheDocument();
  });

  it('"Editar" button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('clicking "Editar" shows subject input and priority select', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('textbox', { name: /asunto/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
  });

  it('"Cancelar" exits edit mode', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('"Eliminar ticket" button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Eliminar ticket' })).toBeInTheDocument();
  });
});
