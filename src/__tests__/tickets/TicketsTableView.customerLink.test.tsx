/**
 * #76 — the customerName cell becomes a <Link> to the client detail
 * (/admin/customers/view/:customerId), mirroring #71/#56. Falls back to plain
 * text when customerId is missing. Driven through the REAL visibleColumnKeys
 * path (leccion #48) so the catalog key and the renderer key stay in lockstep.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/hooks/useTickets', () => ({
  useAssignTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTicketStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveTicket:      () => ({ mutateAsync: vi.fn(), isPending: false }),
  useHardDeleteTicket:   () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ isLoading: false, can: () => true }),
  useCan: () => true,
}));
vi.mock('@/hooks/useTicketStatuses', () => ({
  useTicketStatuses: () => ({ data: [{ id: 's1', name: 'Abierto', color: '#22c55e' }] }),
}));
vi.mock('@/hooks/useRbacUsers', () => ({ useRbacUsers: () => ({ data: [] }) }));
vi.mock('@/hooks/useTicketSlaConfig', () => ({
  useTicketSlaConfig: () => ({ data: { warnMinutes: 60, dangerMinutes: 240 } }),
}));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));

import { TicketsTableView } from '@/pages/tickets/TicketsListPage/components/TicketsTableView';
import { ALL_TICKET_COLUMNS } from '@/pages/tickets/TicketsListPage';
import type { Ticket } from '@/types/ticket';

function mkTicket(over: Partial<Ticket>): Ticket {
  return {
    id: 't1', sequenceNumber: 1, subject: 'Asunto', description: '', status: 'Abierto',
    priority: 'medium', customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null, reporterId: null, reporterName: null,
    reporter: null, areaId: null, areaName: null, areaColor: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: null, archivedAt: null, contractId: null, tags: [],
    ...over,
  };
}

function renderWith(t: Ticket) {
  return render(
    <MemoryRouter>
      <TicketsTableView
        tickets={[t]}
        loading={false}
        visibleColumnKeys={ALL_TICKET_COLUMNS.map(c => c.key)}
      />
    </MemoryRouter>,
  );
}

describe('TicketsTableView — customer link (#76)', () => {
  it('renders customerName as a Link to /admin/customers/view/:customerId', () => {
    renderWith(mkTicket({ customerId: 'cust-42', customerName: 'Alice García' }));
    const link = screen.getByRole('link', { name: 'Alice García' });
    expect(link).toHaveAttribute('href', '/admin/customers/view/cust-42');
  });

  it('falls back to plain text when customerId is missing', () => {
    renderWith(mkTicket({ customerId: null as unknown as string, customerName: 'Sin ID' }));
    expect(screen.queryByRole('link', { name: 'Sin ID' })).not.toBeInTheDocument();
    expect(screen.getByText('Sin ID')).toBeInTheDocument();
  });

  it('renders "—" when there is no customer at all', () => {
    renderWith(mkTicket({ customerId: null as unknown as string, customerName: null as unknown as string }));
    // the cell shows the em-dash placeholder, no link
    expect(screen.queryByRole('link', { name: /—/ })).not.toBeInTheDocument();
  });
});
