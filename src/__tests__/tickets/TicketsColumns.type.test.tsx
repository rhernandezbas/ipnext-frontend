/**
 * #78 — The "Tipo" (key `type`) column is DEAD.
 *
 * Investigation: the BE Ticket domain entity, the TicketDto, ListTickets,
 * CreateTicket and the Prisma `Ticket` model all lack a `type` field. The BE
 * never populates it, so the column rendered empty for every row. We REMOVE it
 * from the catalog and the table renderer.
 *
 * This test pins the removal: `type` must NOT be part of the column catalog, and
 * the table — driven by the REAL visibleColumnKeys path (leccion #48) — must not
 * render a "Tipo" header. A stale 'type' key left over in localStorage must be
 * tolerated (the table .filter() drops unknown keys), not crash.
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
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, tags: [],
    ...over,
  };
}

describe('Tickets list — Tipo column removal (#78)', () => {
  it('does NOT include `type` in the column catalog', () => {
    expect(ALL_TICKET_COLUMNS.map(c => c.key)).not.toContain('type');
  });

  it('does NOT render a "Tipo" header through the real visibleColumnKeys path', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({})]}
          loading={false}
          visibleColumnKeys={ALL_TICKET_COLUMNS.map(c => c.key)}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument();
  });

  it('tolerates a stale `type` key persisted in localStorage (drops it, no crash)', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({})]}
          loading={false}
          visibleColumnKeys={['id', 'type', 'subject']}
        />
      </MemoryRouter>,
    );
    // 'type' has no renderer → dropped; the surviving columns still render.
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument();
    expect(screen.getByText('Tema')).toBeInTheDocument();
  });
});
