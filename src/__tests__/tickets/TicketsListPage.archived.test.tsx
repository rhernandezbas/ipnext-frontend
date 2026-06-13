/**
 * #85 — TicketsListPage archivedView prop + default open status.
 *
 * When archivedView is true:
 *   - passes archived: true to useTicketList
 *   - shows "Tickets Archivados" title
 *   - hides status tabs
 *
 * When rendered normally without explicit status filter:
 *   - defaults to the first non-closed catalog status (e.g. 'open')
 *   - passes it as status: 'open' to useTicketList
 */
import { render, screen } from '@testing-library/react';
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
vi.mock('@/hooks/useTicketAreas', () => ({
  useTicketAreas: () => ({ data: [], isLoading: false }),
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTicket: Ticket = {
  id: 'tid-1',
  sequenceNumber: 1,
  subject: 'Test ticket',
  customerName: 'Alice',
  customerId: 'c1',
  priority: 'high',
  status: 'open',
  type: null,
  assigneeName: 'Juan',
  assigneeId: null,
  reporterId: null, reporterName: null, reporter: null,
  areaId: null, areaName: null, areaColor: null,
  description: '',
  tags: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02',
  resolvedAt: null,
  archivedAt: null,
};

const mockStatuses: TicketStatus[] = [
  { id: '1', name: 'open',    color: '#22c55e', weight: 1 },
  { id: '2', name: 'pending', color: '#f59e0b', weight: 2 },
  { id: '3', name: 'closed',  color: '#6b7280', weight: 3 },
];

function renderList(props: { archivedView?: boolean; statusFilter?: string } = {}) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TicketsListPage {...props} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketsListPage — archivedView (#85)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [mockTicket], total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useCreateTicket>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['*'],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  });

  it('archivedView passes archived: true to useTicketList', () => {
    renderList({ archivedView: true });
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.archived).toBe(true);
  });

  it('archivedView shows "Tickets Archivados" title', () => {
    renderList({ archivedView: true });
    expect(screen.getByRole('heading', { name: 'Tickets Archivados' })).toBeInTheDocument();
  });

  it('archivedView hides the catalog status tabs', () => {
    renderList({ archivedView: true });
    expect(screen.queryByRole('button', { name: /todos/i })).not.toBeInTheDocument();
  });

  it('archivedView does NOT pass a status to useTicketList', () => {
    renderList({ archivedView: true });
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBeUndefined();
  });
});

describe('TicketsListPage — default open status (#85)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: [mockTicket], total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useCreateTicket>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['*'],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  });

  it('main list without explicit status defaults to the first non-closed catalog status', () => {
    renderList();
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    // 'open' is the first non-closed status in the mock catalog
    expect(lastCall.status).toBe('open');
  });

  it('main list does NOT pass archived: true when not archivedView', () => {
    renderList();
    const calls = vi.mocked(useTicketsModule.useTicketList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.archived).toBeFalsy();
  });
});
