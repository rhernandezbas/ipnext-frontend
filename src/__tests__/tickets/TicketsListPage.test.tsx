import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketsListPage from '@/pages/tickets/TicketsListPage';
import * as useTicketsModule from '@/hooks/useTickets';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import type { Ticket } from '@/types/ticket';
import type { TicketStatus } from '@/types/ticketStatus';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTicketStatuses');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTickets: Ticket[] = [
  {
    id: 1,
    subject: 'Problema de conexión',
    customerName: 'Alice García',
    customerId: 1,
    priority: 'high',
    status: 'open',
    type: null,
    assignedToName: 'Juan',
    assignedTo: null,
    reporter: null,
    message: 'Sin internet',
    tags: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    resolvedAt: null,
  },
];

const mockStatuses: TicketStatus[] = [
  { id: '1', name: 'open', color: '#22c55e', weight: 1 },
  { id: '2', name: 'pending', color: '#f59e0b', weight: 2 },
  { id: '3', name: 'closed', color: '#6b7280', weight: 3 },
];

function renderList(statusFilter?: string) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TicketsListPage statusFilter={statusFilter} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: mockTickets, total: 1 },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicketList>);
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    // Mock all other hooks from useTickets to avoid "not a function" errors
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useTicketsModule.useDeleteTicket>);
  });

  it('renders "Lista de Tickets" title by default', () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Lista de Tickets' })).toBeInTheDocument();
  });

  it('renders "Archivo de Tickets" when statusFilter is closed', () => {
    renderList('closed');
    expect(screen.getByRole('heading', { name: 'Archivo de Tickets' })).toBeInTheDocument();
  });

  it('renders ticket rows', () => {
    renderList();
    expect(screen.getByText('Problema de conexión')).toBeInTheDocument();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
  });

  it('renders Estado and Prioridad filter dropdowns', () => {
    renderList();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Prioridad' })).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderList();
    expect(screen.getByPlaceholderText('Buscar por asunto o cliente...')).toBeInTheDocument();
  });

  it('shows empty message when no tickets', () => {
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicketList>);
    renderList();
    expect(screen.getByText('No hay tickets.')).toBeInTheDocument();
  });

  it('passes status filter to useTicketList', () => {
    renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), {
      target: { value: 'open' },
    });
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('open');
  });

  it('passes priority filter to useTicketList', () => {
    renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridad' }), {
      target: { value: 'high' },
    });
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.priority).toBe('high');
  });

  // Catalog-driven tab tests
  it('renders a "Todos" tab', () => {
    renderList();
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
  });

  it('renders one tab per catalog status', () => {
    renderList();
    // Todos + 3 catalog statuses = 4 tabs
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /closed/i })).toBeInTheDocument();
  });

  it('does NOT render hardcoded "Resuelto" or "En progreso" tabs', () => {
    renderList();
    expect(screen.queryByRole('button', { name: /^resuelto$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^en progreso$/i })).not.toBeInTheDocument();
  });

  it('clicking a catalog tab filters by that status', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('open');
  });

  it('clicking "Todos" tab clears status filter', () => {
    renderList();
    // First filter to open
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    // Then click Todos
    fireEvent.click(screen.getByRole('button', { name: /todos/i }));
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBeUndefined();
  });

  it('shows loading tabs placeholder when catalog is loading', () => {
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    renderList();
    // Should still render Todos at minimum
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
  });
});
