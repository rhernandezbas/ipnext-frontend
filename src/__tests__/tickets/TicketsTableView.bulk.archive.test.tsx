/**
 * #85 — TicketsTableView bulk archive + hard-delete actions.
 *
 * "Archivar" is gated by tickets.close and only enabled when ALL selected
 * tickets are closed (CLOSED_SLUGS match). "Eliminar definitivamente" is gated
 * by tickets.delete_hard and requires a confirm with irreversible copy.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const assignAsync = vi.fn();
const statusAsync = vi.fn();
const deleteAsync = vi.fn();
const archiveAsync = vi.fn();
const hardDeleteAsync = vi.fn();

vi.mock('@/hooks/useTickets', () => ({
  useAssignTicket:       () => ({ mutateAsync: assignAsync, isPending: false }),
  useUpdateTicketStatus: () => ({ mutateAsync: statusAsync, isPending: false }),
  useDeleteTicket:       () => ({ mutateAsync: deleteAsync, isPending: false }),
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

const confirmFn = vi.fn().mockResolvedValue(true);
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => confirmFn }));

import { TicketsTableView } from '@/pages/tickets/TicketsListPage/components/TicketsTableView';
import type { Ticket } from '@/types/ticket';

function mkTicket(id: string, seq: number, status = 'Abierto'): Ticket {
  return {
    id, sequenceNumber: seq, subject: `Asunto ${seq}`, description: '', status,
    priority: 'medium', type: null, customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null,
    reporterId: null, reporterName: null, reporter: null,
    areaId: null, areaName: null, areaColor: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, archivedAt: null,
    tags: [],
  };
}

/** Two open tickets */
const openTickets = [mkTicket('t1', 1, 'Abierto'), mkTicket('t2', 2, 'Abierto')];
/** Two closed tickets */
const closedTickets = [mkTicket('t3', 3, 'Cerrado'), mkTicket('t4', 4, 'Cerrado')];
/** Mixed: one closed, one open */
const mixedTickets = [mkTicket('t5', 5, 'Cerrado'), mkTicket('t6', 6, 'Abierto')];

function setup(tickets: Ticket[]) {
  return render(
    <MemoryRouter>
      <TicketsTableView tickets={tickets} loading={false} />
    </MemoryRouter>,
  );
}

function selectAll() {
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]); // header select-all
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
  permissions = ['tickets.write', 'tickets.close', 'tickets.delete', 'tickets.delete_hard'];
});

describe('TicketsTableView — bulk Archivar', () => {
  it('renders "Archivar" button when permissions include tickets.close', () => {
    permissions = ['tickets.close'];
    setup(openTickets);
    selectAll();
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeInTheDocument();
  });

  it('"Archivar" is disabled when at least one selected ticket is NOT closed', () => {
    permissions = ['tickets.close'];
    setup(mixedTickets);
    selectAll();
    const btn = screen.getByRole('button', { name: 'Archivar' });
    expect(btn).toBeDisabled();
  });

  it('"Archivar" is disabled when ALL selected tickets are open (not closed)', () => {
    permissions = ['tickets.close'];
    setup(openTickets);
    selectAll();
    const btn = screen.getByRole('button', { name: 'Archivar' });
    expect(btn).toBeDisabled();
  });

  it('"Archivar" is enabled when ALL selected tickets are closed', () => {
    permissions = ['tickets.close'];
    setup(closedTickets);
    selectAll();
    const btn = screen.getByRole('button', { name: 'Archivar' });
    expect(btn).not.toBeDisabled();
  });

  it('clicking "Archivar" (when enabled) calls archiveAsync for each selected id', async () => {
    permissions = ['tickets.close'];
    archiveAsync.mockResolvedValue({});
    setup(closedTickets);
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));

    await waitFor(() => expect(archiveAsync).toHaveBeenCalledTimes(2));
    expect(archiveAsync).toHaveBeenCalledWith('t3');
    expect(archiveAsync).toHaveBeenCalledWith('t4');
  });

  it('"Archivar" is NOT visible when permissions lack tickets.close', () => {
    permissions = ['tickets.write', 'tickets.delete'];
    setup(closedTickets);
    selectAll();
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
  });
});

describe('TicketsTableView — bulk Eliminar definitivamente', () => {
  it('"Eliminar definitivamente" is NOT present when permissions lack tickets.delete_hard', () => {
    permissions = ['tickets.write', 'tickets.close', 'tickets.delete'];
    setup(openTickets);
    selectAll();
    expect(screen.queryByRole('button', { name: 'Eliminar definitivamente' })).not.toBeInTheDocument();
  });

  it('"Eliminar definitivamente" IS present when permissions include tickets.delete_hard', () => {
    permissions = ['tickets.delete_hard'];
    setup(openTickets);
    selectAll();
    expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeInTheDocument();
  });

  it('clicking "Eliminar definitivamente" shows confirm dialog with irreversible copy', async () => {
    permissions = ['tickets.delete_hard'];
    setup(openTickets);
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    const arg = confirmFn.mock.calls[0][0];
    expect(arg.tone).toBe('danger');
    // Must convey irreversibility
    expect(arg.message).toMatch(/irreversible|definitiv|permanente/i);
  });

  it('after confirm, calls hardDeleteAsync for each selected id', async () => {
    permissions = ['tickets.delete_hard'];
    hardDeleteAsync.mockResolvedValue(undefined);
    setup(openTickets);
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(hardDeleteAsync).toHaveBeenCalledTimes(2));
    expect(hardDeleteAsync).toHaveBeenCalledWith('t1');
    expect(hardDeleteAsync).toHaveBeenCalledWith('t2');
  });

  it('cancelling the confirm does NOT call hardDeleteAsync', async () => {
    permissions = ['tickets.delete_hard'];
    confirmFn.mockResolvedValue(false);
    setup(openTickets);
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(hardDeleteAsync).not.toHaveBeenCalled();
  });
});
