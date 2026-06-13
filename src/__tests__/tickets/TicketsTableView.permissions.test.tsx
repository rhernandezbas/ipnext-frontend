/**
 * #46 — TicketsTableView permission gating + empty states.
 * Each bulk action is Can-gated per the wire contract; the Eliminar confirm
 * aclara el soft-close. Empty states differ: sin tickets vs. sin resultados.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const assignAsync = vi.fn();
const statusAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock('@/hooks/useTickets', () => ({
  useAssignTicket:       () => ({ mutateAsync: assignAsync, isPending: false }),
  useUpdateTicketStatus: () => ({ mutateAsync: statusAsync, isPending: false }),
  useDeleteTicket:       () => ({ mutateAsync: deleteAsync, isPending: false }),
  useArchiveTicket:      () => ({ mutateAsync: vi.fn(), isPending: false }),
  useHardDeleteTicket:   () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  useTicketStatuses: () => ({ data: [{ id: 's2', name: 'Cerrado', color: '#000' }] }),
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

function mkTicket(id: string, seq: number): Ticket {
  return {
    id, sequenceNumber: seq, subject: `Asunto ${seq}`, description: '', status: 'Abierto',
    priority: 'medium', type: null, customerId: 'c1', customerName: 'Cliente',
    assigneeId: null, assigneeName: null,
    reporterId: null, reporterName: null, reporter: null,
    areaId: null, areaName: null, areaColor: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, archivedAt: null, tags: [],
  };
}
const tickets = [mkTicket('t1', 1), mkTicket('t2', 2)];

function setup(props: Partial<React.ComponentProps<typeof TicketsTableView>> = {}) {
  return render(
    <MemoryRouter>
      <TicketsTableView tickets={tickets} loading={false} {...props} />
    </MemoryRouter>,
  );
}
function selectAll() { fireEvent.click(screen.getAllByRole('checkbox')[0]); }

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
});

describe('TicketsTableView — permission gating', () => {
  it('with write+close but no delete: Asignar/Cambiar estado/Cerrar show, Eliminar hidden', () => {
    permissions = ['tickets.write', 'tickets.close'];
    setup();
    selectAll();
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar estado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('Cerrar is gated by tickets.close, NOT tickets.write (hidden with write alone)', () => {
    permissions = ['tickets.write'];
    setup();
    selectAll();
    // write still shows the write actions...
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar estado' })).toBeInTheDocument();
    // ...but Cerrar needs tickets.close.
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });

  it('tickets.close alone shows Cerrar (even without write)', () => {
    permissions = ['tickets.close'];
    setup();
    selectAll();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
  });

  it('without tickets.write, the write actions are hidden but Eliminar shows', () => {
    permissions = ['tickets.delete'];
    setup();
    selectAll();
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('Eliminar confirm aclara el soft-close (cierra y conserva el historial)', async () => {
    permissions = ['tickets.delete'];
    deleteAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    const arg = confirmFn.mock.calls[0][0];
    expect(arg.message).toMatch(/cierra/i);
    expect(arg.message).toMatch(/historial/i);
  });

  it('cancelling the Eliminar confirm emits no request and keeps the selection', async () => {
    permissions = ['tickets.delete'];
    confirmFn.mockResolvedValue(false);
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(deleteAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('ticket-bulk-bar')).toBeInTheDocument();
  });
});

describe('TicketsTableView — empty states', () => {
  it('no tickets at all → create-CTA copy', () => {
    permissions = ['tickets.write'];
    setup({ tickets: [], hasActiveFilters: false });
    expect(screen.getByText(/No hay tickets/i)).toBeInTheDocument();
  });

  it('no results with active filters → "Limpiar filtros" action', () => {
    permissions = ['tickets.write'];
    const onClear = vi.fn();
    setup({ tickets: [], hasActiveFilters: true, onClearFilters: onClear });
    expect(screen.getByText(/Sin resultados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
