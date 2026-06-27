/**
 * #7 — TicketsTableView bulk bar: Eliminar (soft-delete) and Eliminar definitivamente
 * (hard-delete) MUST NOT appear. Archivar MUST be present and call archiveAsync
 * when all selected tickets are closed.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const archiveAsync = vi.fn();
const hardDeleteAsync = vi.fn();

vi.mock('@/hooks/useTickets', () => ({
  useAssignTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTicketStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTicket:       () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveTicket:      () => ({ mutateAsync: archiveAsync, isPending: false }),
  useHardDeleteTicket:   () => ({ mutateAsync: hardDeleteAsync, isPending: false }),
}));

let permissions: string[] = [];
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    isLoading: false,
    can: (perm: string | string[]) => {
      const arr = Array.isArray(perm) ? perm : [perm];
      return arr.some(p => permissions.includes(p));
    },
  }),
  useCan: (perm: string) => permissions.includes(perm),
}));

vi.mock('@/hooks/useTicketStatuses', () => ({
  useTicketStatuses: () => ({ data: [
    { id: 's1', name: 'Abierto', color: '#22c55e' },
    { id: 's2', name: 'Cerrado', color: '#000000' },
  ] }),
}));
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: () => ({ data: [{ id: 'u1', name: 'Luis' }] }),
}));
vi.mock('@/hooks/useTicketSlaConfig', () => ({
  useTicketSlaConfig: () => ({ data: { warnMinutes: 60, dangerMinutes: 240 } }),
}));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));

import { TicketsTableView } from '@/pages/tickets/TicketsListPage/components/TicketsTableView';
import type { Ticket } from '@/types/ticket';

function mkTicket(id: string, seq: number, status = 'Cerrado'): Ticket {
  return {
    id, sequenceNumber: seq, subject: `Ticket ${seq}`, description: '', status,
    priority: 'medium', type: null, customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null,
    reporterId: null, reporterName: null, reporter: null,
    areaId: null, areaName: null, areaColor: null,
    contractId: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, archivedAt: null, tags: [],
  };
}

const closedTickets = [mkTicket('t1', 1, 'Cerrado'), mkTicket('t2', 2, 'Cerrado')];

function setup(tickets = closedTickets) {
  return render(
    <MemoryRouter>
      <TicketsTableView tickets={tickets} loading={false} />
    </MemoryRouter>,
  );
}

function selectAll() {
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = ['tickets.write', 'tickets.close', 'tickets.delete', 'tickets.delete_hard', 'tickets.manage'];
});

describe('TicketsTableView — bulk bar: Eliminar buttons removed (#7)', () => {
  it('bulk soft-delete "Eliminar" is NOT in the bar even with tickets.delete permission', () => {
    // Render with selection; tickets.delete is in permissions but the button must be gone.
    setup();
    selectAll();
    // The bar should be visible
    expect(screen.getByTestId('ticket-bulk-bar')).toBeInTheDocument();
    // Neither delete variant should appear
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('bulk hard-delete "Eliminar definitivamente" is NOT in the bar even with tickets.delete_hard permission', () => {
    setup();
    selectAll();
    expect(screen.queryByRole('button', { name: 'Eliminar definitivamente' })).not.toBeInTheDocument();
  });

  it('"Archivar" IS present in the bulk bar (with tickets.manage)', () => {
    setup();
    selectAll();
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeInTheDocument();
  });

  it('"Archivar" calls archiveAsync for each selected closed ticket', async () => {
    archiveAsync.mockResolvedValue({});
    setup();
    selectAll();
    const btn = screen.getByRole('button', { name: 'Archivar' });
    fireEvent.click(btn);
    await waitFor(() => expect(archiveAsync).toHaveBeenCalledTimes(2));
    expect(archiveAsync).toHaveBeenCalledWith('t1');
    expect(archiveAsync).toHaveBeenCalledWith('t2');
  });

  it('"Limpiar" is still present in the bulk bar', () => {
    setup();
    selectAll();
    expect(screen.getByRole('button', { name: 'Limpiar selección' })).toBeInTheDocument();
  });
});
