import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketsListPage from '@/pages/tickets/TicketsListPage';
import * as useTicketsModule from '@/hooks/useTickets';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import type { Ticket } from '@/types/ticket';
import type { TicketStatus } from '@/types/ticketStatus';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useRbacUsers');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTickets: Ticket[] = [
  {
    id: '1',
    sequenceNumber: 1,
    subject: 'Problema de conexión',
    customerName: 'Alice García',
    customerId: '1',
    priority: 'high',
    status: 'open',
    type: null,
    assigneeName: 'Juan',
    assigneeId: null,
    reporterId: null,
    reporterName: null,
    reporter: null,
    description: 'Sin internet',
    tags: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    resolvedAt: null,
    contractId: null,
    areaId: null,
    areaName: null,
    areaColor: null,
    archivedAt: null,
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

describe('TicketsListPage (Prominense re-skin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: mockTickets, total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useCreateTicket>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['*'],
      isLoading: false,
    } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  });

  // ── Prominense chrome ──────────────────────────────────────────────────────
  it('renders the header with breadcrumb and title', () => {
    renderList();
    expect(screen.getByText('Soporte /')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lista de Tickets' })).toBeInTheDocument();
  });

  it('renders the archive title when statusFilter is closed (Archive page preserved)', () => {
    renderList('closed');
    expect(screen.getByRole('heading', { name: 'Archivo de Tickets' })).toBeInTheDocument();
  });

  it('renders the ColumnSelector and Recargar controls', () => {
    renderList();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
    // ColumnSelector exposes a "Columnas" trigger button.
    expect(screen.getByRole('button', { name: /columnas/i })).toBeInTheDocument();
  });

  it('renders "Crear ticket" only when the user has tickets.write', () => {
    renderList();
    expect(screen.getByRole('button', { name: /crear ticket/i })).toBeInTheDocument();
  });

  it('hides "Crear ticket" when the user lacks tickets.write', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      permissions: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderList();
    expect(screen.queryByRole('button', { name: /crear ticket/i })).not.toBeInTheDocument();
  });

  it('opens the CreateTicketModal when "Crear ticket" is clicked', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /crear ticket/i }));
    expect(screen.getByRole('dialog', { name: /nuevo ticket/i })).toBeInTheDocument();
  });

  // ── Origin behavior preserved ──────────────────────────────────────────────
  it('renders ticket rows', () => {
    renderList();
    expect(screen.getByText('Problema de conexión')).toBeInTheDocument();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
  });

  // #28 follow-up: the BE returns `assigneeName`, but the column used to read
  // `assignedToName` (legacy mock contract) so it rendered empty for EVERY row.
  it('renders the assignee name in the "Asignado a" column', () => {
    renderList();
    expect(screen.getByText('Juan')).toBeInTheDocument();
  });

  // #26 — the status renders as a pill: catalog color for open states, and a
  // distinctive BLACK & WHITE variant for closed/cerrado so they stand out.
  it('renders the status as a pill colored from the catalog', () => {
    renderList();
    const pill = screen.getByLabelText('Estado: open');
    expect(pill).toBeInTheDocument();
    expect(pill).not.toHaveAttribute('data-variant', 'closed');
  });

  it('renders closed tickets with the black & white variant (#26)', () => {
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [{ ...mockTickets[0], id: 2, subject: 'Resuelto hace mucho', status: 'closed' }], total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    renderList();
    const pill = screen.getByLabelText('Estado: closed');
    expect(pill).toHaveAttribute('data-variant', 'closed');
  });

  it('treats the Spanish "cerrado" slug as closed too (#26)', () => {
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [{ ...mockTickets[0], id: 3, subject: 'Cerrado ES', status: 'cerrado' }], total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    renderList();
    expect(screen.getByLabelText('Estado: cerrado')).toHaveAttribute('data-variant', 'closed');
  });

  it('shows the no-tickets empty state when there are no tickets and no filters (#46)', () => {
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    renderList();
    // #46 — differentiated empty states; with no active filters this is the
    // "no tickets todavía" copy (the "Limpiar filtros" variant is covered in
    // TicketsTableView.permissions.test.tsx).
    expect(screen.getByText(/No hay tickets todav/i)).toBeInTheDocument();
  });

  it('renders a "Todos" tab plus one tab per catalog status', () => {
    renderList();
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
  });

  it('does NOT render hardcoded legacy tabs', () => {
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

  it('clicking "Todos" falls back to the default open status (#85)', () => {
    // #85 — "Todos" no longer means "show all" — the list defaults to the first
    // non-closed catalog status. After clicking "open" then "Todos", the effective
    // status resolves to 'open' (first non-closed in the mock catalog).
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    fireEvent.click(screen.getByRole('button', { name: /todos/i }));
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('open');
  });

  it('locks the query to the archive status when statusFilter is closed', () => {
    renderList('closed');
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('closed');
  });

  it('ticket rows are rendered in the list view (#46)', () => {
    renderList();
    // #7 — bulk soft-delete removed from TicketsTableView in change archive-bulk-parity.
    // The ticket row itself still renders correctly.
    expect(screen.getByText('Problema de conexión')).toBeInTheDocument();
  });
});
