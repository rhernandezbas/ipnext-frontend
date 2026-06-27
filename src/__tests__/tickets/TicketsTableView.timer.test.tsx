/**
 * #79 — The "Timer" column renders through the REAL visibleColumnKeys path
 * (leccion #48): the catalog key ('timer') and the table renderer key must match,
 * else the column silently vanishes from the live list. We drive the elapsed
 * minutes via a fixed createdAt + the config from the mocked hook, then assert
 * the pill text and its threshold level.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));
vi.mock('@/hooks/useTicketSlaConfig', () => ({
  useTicketSlaConfig: () => ({ data: { warnMinutes: 60, dangerMinutes: 240 } }),
}));

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

describe('TicketsTableView — Timer column (#79)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('catalog has `timer` at position 3 (after id, areaName)', () => {
    const keys = ALL_TICKET_COLUMNS.map(c => c.key);
    expect(keys[2]).toBe('timer');
  });

  it('renders the "Timer" header through the real visibleColumnKeys path', () => {
    vi.setSystemTime(new Date('2026-01-01T00:30:00.000Z')); // 30 min elapsed
    renderWith(mkTicket({}));
    expect(screen.getByText('Timer')).toBeInTheDocument();
  });

  it('shows "{n} min" green (ok) under the warn threshold', () => {
    vi.setSystemTime(new Date('2026-01-01T00:30:00.000Z')); // 30 min < 60
    renderWith(mkTicket({}));
    const pill = screen.getByLabelText(/Timer SLA: 30 min/);
    expect(pill).toHaveAttribute('data-level', 'ok');
  });

  it('escalates to danger (red) at/over the danger threshold', () => {
    vi.setSystemTime(new Date('2026-01-01T05:00:00.000Z')); // 300 min >= 240
    renderWith(mkTicket({}));
    const pill = screen.getByLabelText(/Timer SLA: 5h 0m/);
    expect(pill).toHaveAttribute('data-level', 'danger');
  });

  it('freezes a closed ticket in the neutral level regardless of elapsed', () => {
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z')); // days elapsed
    renderWith(mkTicket({ status: 'closed' }));
    const pill = screen.getByLabelText(/cerrado/);
    expect(pill).toHaveAttribute('data-level', 'closed');
  });

  // #84 — freeze at resolvedAt, not at Date.now()
  it('#84: closed ticket with resolvedAt shows frozen elapsed (resolvedAt - createdAt), not now - createdAt', () => {
    // createdAt = 2026-01-01T00:00:00Z
    // resolvedAt = 2026-01-01T02:00:00Z  → 120 min elapsed (frozen)
    // now = 2026-01-10T00:00:00Z         → 12,960 min if NOT frozen
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    renderWith(mkTicket({
      status: 'closed',
      resolvedAt: '2026-01-01T02:00:00.000Z',
      createdAt:  '2026-01-01T00:00:00.000Z',
    }));
    // 120 min = 2h 0m; the pill must show the frozen value, NOT the huge now-based elapsed
    const pill = screen.getByLabelText(/Timer SLA: 2h 0m/);
    expect(pill).toHaveAttribute('data-level', 'closed');
  });

  it('#84: closed ticket with resolvedAt: null falls back to updatedAt for freeze', () => {
    // createdAt = 2026-01-01T00:00:00Z
    // updatedAt = 2026-01-01T01:00:00Z  → 60 min = 1h 0m elapsed (frozen via updatedAt)
    // resolvedAt = null
    // now = 2026-01-10T00:00:00Z        → would be 12960 min = 216h 0m if NOT frozen
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    renderWith(mkTicket({
      status: 'closed',
      resolvedAt: null,
      updatedAt: '2026-01-01T01:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    }));
    // 60 min = 1h 0m (formatElapsed threshold: < 60 → "{n} min", >= 60 → "{h}h {m}m")
    // NOT the huge now-based elapsed (12960 min = 216h 0m)
    const pill = screen.getByLabelText(/Timer SLA: 1h 0m/);
    expect(pill).toHaveAttribute('data-level', 'closed');
  });

  it('#84: open ticket continues to use live now (not frozen)', () => {
    // createdAt = 2026-01-01T00:00:00Z
    // now = 2026-01-01T00:30:00Z → 30 min
    vi.setSystemTime(new Date('2026-01-01T00:30:00.000Z'));
    renderWith(mkTicket({
      status: 'Abierto',
      resolvedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }));
    const pill = screen.getByLabelText(/Timer SLA: 30 min/);
    expect(pill).toHaveAttribute('data-level', 'ok');
  });
});
