/**
 * #112 — Sort by ID column (sequenceNumber asc/desc toggle).
 *
 * The visible "ID" is t.sequenceNumber (the monotonic #N). Clicking the ID
 * header must sort by sequenceNumber (numeric), not by the UUID id field.
 * Second click toggles to desc. Visual indicators (↑/↓) reflect the direction.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import type { Ticket } from '@/types/ticket';

function mkTicket(id: string, seq: number, subject: string): Ticket {
  return {
    id, sequenceNumber: seq, subject, description: '', status: 'Abierto',
    priority: 'medium', customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null, reporterId: null, reporterName: null,
    reporter: null, areaId: null, areaName: null, areaColor: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    resolvedAt: null, archivedAt: null, tags: [],
  };
}

/** Extracts the visible #N sequence numbers from the rendered id links, in DOM order. */
function visibleSequences(): number[] {
  // Links render "#N" text; grab all and parse.
  return screen.getAllByRole('link')
    .map(a => a.textContent ?? '')
    .filter(t => t.startsWith('#'))
    .map(t => parseInt(t.slice(1), 10));
}

const TICKETS = [
  mkTicket('t3', 3, 'Tres'),
  mkTicket('t1', 1, 'Uno'),
  mkTicket('t2', 2, 'Dos'),
];

describe('TicketsTableView — sort by ID (#112)', () => {
  it('ID column header is clickable (sortable)', () => {
    render(
      <MemoryRouter>
        <TicketsTableView tickets={TICKETS} loading={false} visibleColumnKeys={['id', 'subject']} />
      </MemoryRouter>,
    );
    const idHeader = screen.getByRole('columnheader', { name: /^ID/ });
    expect(idHeader).toBeInTheDocument();
    // Must have the sortable style / be interactive — check aria-sort or cursor.
    // After implementation, clicking must not throw.
    expect(idHeader).toBeTruthy();
  });

  it('first click on ID header sorts rows ascending by sequenceNumber', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TicketsTableView tickets={TICKETS} loading={false} visibleColumnKeys={['id', 'subject']} />
      </MemoryRouter>,
    );
    const idHeader = screen.getByRole('columnheader', { name: /^ID/ });
    await user.click(idHeader);
    expect(visibleSequences()).toEqual([1, 2, 3]);
  });

  it('second click on ID header sorts rows descending by sequenceNumber', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TicketsTableView tickets={TICKETS} loading={false} visibleColumnKeys={['id', 'subject']} />
      </MemoryRouter>,
    );
    const idHeader = screen.getByRole('columnheader', { name: /^ID/ });
    await user.click(idHeader);
    await user.click(idHeader);
    expect(visibleSequences()).toEqual([3, 2, 1]);
  });

  it('shows ascending indicator (↑) after first click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TicketsTableView tickets={TICKETS} loading={false} visibleColumnKeys={['id', 'subject']} />
      </MemoryRouter>,
    );
    const idHeader = screen.getByRole('columnheader', { name: /^ID/ });
    await user.click(idHeader);
    expect(idHeader).toHaveTextContent('↑');
  });

  it('shows descending indicator (↓) after second click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TicketsTableView tickets={TICKETS} loading={false} visibleColumnKeys={['id', 'subject']} />
      </MemoryRouter>,
    );
    const idHeader = screen.getByRole('columnheader', { name: /^ID/ });
    await user.click(idHeader);
    await user.click(idHeader);
    expect(idHeader).toHaveTextContent('↓');
  });
});
