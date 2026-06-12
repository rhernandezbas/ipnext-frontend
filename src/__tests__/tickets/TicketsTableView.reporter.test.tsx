/**
 * #48 fix-wave (M1) — the LISTADO's Reporter column.
 *
 * Regression: the column was keyed on the deprecated `reporter` field (which the
 * BE no longer sends), so it rendered empty forever. The BE sends `reporterName`
 * on the list (shared INCLUDE). The column must read `reporterName`, falling back
 * to '—' when null.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/hooks/useTickets', () => ({
  useAssignTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTicketStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ isLoading: false, can: () => true }),
  useCan: () => true,
}));
vi.mock('@/hooks/useTicketStatuses', () => ({
  useTicketStatuses: () => ({ data: [{ id: 's1', name: 'Abierto', color: '#22c55e' }] }),
}));
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: () => ({ data: [] }),
}));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));

import { TicketsTableView } from '@/pages/tickets/TicketsListPage/components/TicketsTableView';
import type { Ticket } from '@/types/ticket';

function mkTicket(over: Partial<Ticket>): Ticket {
  return {
    id: 't1', sequenceNumber: 1, subject: 'Asunto', description: '', status: 'Abierto',
    priority: 'medium', type: null, customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null, reporterId: null, reporterName: null,
    reporter: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, tags: [],
    ...over,
  };
}

function setup(tickets: Ticket[]) {
  return render(
    <MemoryRouter>
      <TicketsTableView tickets={tickets} loading={false} />
    </MemoryRouter>,
  );
}

describe('TicketsTableView — Reporter column (#48 M1)', () => {
  it('renders the reporterName the BE sends in the list', () => {
    setup([mkTicket({ reporterId: 'u9', reporterName: 'María Creadora' })]);
    expect(screen.getByText('María Creadora')).toBeInTheDocument();
  });

  it('falls back to "—" when reporterName is null', () => {
    setup([mkTicket({ reporterName: null })]);
    // The dash appears as the Reporter cell content. There is no other em-dash
    // column in this fixture, so a single match is enough.
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
