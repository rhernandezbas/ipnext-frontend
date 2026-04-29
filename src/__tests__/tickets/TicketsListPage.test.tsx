import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketsListPage from '@/pages/tickets/TicketsListPage';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Ticket } from '@/types/ticket';

vi.mock('@/hooks/useTickets');

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
});
