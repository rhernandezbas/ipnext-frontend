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
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: () => ({ data: [] }),
}));
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
    priority: 'medium', type: null, customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null, reporterId: null, reporterName: null,
    reporter: null, areaId: null, areaName: null, areaColor: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, archivedAt: null, contractId: null, tags: [],
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
    // #69 — give the ticket an area so the Área column doesn't also render a dash;
    // then the single '—' belongs to the Reporter cell.
    setup([mkTicket({ reporterName: null, areaId: 'a1', areaName: 'Soporte', areaColor: '#6366f1' })]);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // Re-review del fix wave: la page SIEMPRE pasa visibleColumnKeys derivadas de
  // ALL_TICKET_COLUMNS; si la key del catalogo y la del table view divergen,
  // la columna Reporter desaparece del listado real (el fallback sin
  // visibleColumnKeys del test de arriba no lo detecta).
  it('renders the Reporter column through the real visibleColumnKeys path', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({ reporterId: 'u9', reporterName: 'María Creadora' })]}
          loading={false}
          visibleColumnKeys={ALL_TICKET_COLUMNS.map(c => c.key)}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Reporter')).toBeInTheDocument();
    expect(screen.getByText('María Creadora')).toBeInTheDocument();
  });
});
