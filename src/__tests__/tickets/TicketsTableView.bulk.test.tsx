/**
 * #46 — TicketsTableView bulk actions (AD-6, AD-7).
 *
 * Bulk runs N requests via mapWithConcurrency(limit 5) over the existing hooks'
 * mutateAsync. Full success → toast + cleared selection; partial failure → toast
 * "X de N no se pudieron {verbo}" + selection narrowed to ONLY the failed ids (for retry).
 * Actions are Can-gated; Cerrar resolves the closed catalog name via CLOSED_SLUGS.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

let permissions: string[] = ['tickets.write', 'tickets.delete'];
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
  useRbacUsers: () => ({ data: [{ id: 'u1', name: 'Luis' }, { id: 'u2', name: 'Ana' }] }),
}));
vi.mock('@/hooks/useTicketSlaConfig', () => ({
  useTicketSlaConfig: () => ({ data: { warnMinutes: 60, dangerMinutes: 240 } }),
}));

// Auto-confirm every confirm() dialog (the confirm copy is asserted separately
// in the permissions suite via the message argument).
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
    contractId: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    resolvedAt: null, archivedAt: null, tags: [],
  };
}
const tickets = [1, 2, 3, 4, 5].map(n => mkTicket(`t${n}`, n));

function setup() {
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
  permissions = ['tickets.write', 'tickets.close', 'tickets.delete'];
  confirmFn.mockResolvedValue(true);
});

describe('TicketsTableView — bulk execution', () => {
  it('full success: assigns all 5, toast with count, selection cleared', async () => {
    assignAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    // Pick an assignee in the picker dialog and confirm.
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(assignAsync).toHaveBeenCalledTimes(5));
    expect(assignAsync).toHaveBeenCalledWith({ id: 't1', assigneeId: 'u1' });
    await waitFor(() => expect(screen.getByText(/5 tickets asignados/)).toBeInTheDocument());
    // Selection cleared → bar gone.
    expect(screen.queryByTestId('ticket-bulk-bar')).not.toBeInTheDocument();
  });

  it('partial failure (2/5): toast "2 de 5 no se pudieron asignar" and only failed ids stay selected', async () => {
    // Reject for t2 and t4.
    assignAsync.mockImplementation(({ id }: { id: string }) =>
      id === 't2' || id === 't4' ? Promise.reject(new Error('boom')) : Promise.resolve({}));
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(screen.getByText(/2 de 5 no se pudieron asignar/)).toBeInTheDocument());
    // Bar still visible with the 2 failed.
    const bar = screen.getByTestId('ticket-bulk-bar');
    expect(within(bar).getByText(/2 ticket/)).toBeInTheDocument();
  });

  it('partial failure: the row CHECKBOXES reflect only the failed ids (UI does not lie)', async () => {
    // Reject for t2 and t4 — those two must remain checked, the rest unchecked.
    assignAsync.mockImplementation(({ id }: { id: string }) =>
      id === 't2' || id === 't4' ? Promise.reject(new Error('boom')) : Promise.resolve({}));
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(screen.getByText(/2 de 5 no se pudieron asignar/)).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const [, c1, c2, c3, c4, c5] = checkboxes; // [0] header, then rows t1..t5
    expect(c1.checked).toBe(false); // t1 ok
    expect(c2.checked).toBe(true);  // t2 failed
    expect(c3.checked).toBe(false); // t3 ok
    expect(c4.checked).toBe(true);  // t4 failed
    expect(c5.checked).toBe(false); // t5 ok
  });

  it('full success: every row CHECKBOX is cleared (not just the bar)', async () => {
    assignAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(screen.queryByTestId('ticket-bulk-bar')).not.toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.some(cb => cb.checked)).toBe(false);
  });

  it('Cerrar emits PATCH status with the closed catalog name for every id', async () => {
    statusAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(statusAsync).toHaveBeenCalledTimes(5));
    expect(statusAsync).toHaveBeenCalledWith({ id: 't1', status: 'Cerrado' });
  });

  it('Cambiar estado picks a catalog status and applies it to all', async () => {
    statusAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar estado' }));
    const dialog = screen.getByRole('dialog', { name: /estado/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Abierto' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(statusAsync).toHaveBeenCalledTimes(5));
    expect(statusAsync).toHaveBeenCalledWith({ id: 't3', status: 'Abierto' });
  });
});

describe('TicketsTableView — toast copy per action', () => {
  it('Asignar success → "N tickets asignados"', async () => {
    assignAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    await waitFor(() => expect(screen.getByText('5 tickets asignados')).toBeInTheDocument());
  });

  it('Cambiar estado success → "N tickets actualizados"', async () => {
    statusAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar estado' }));
    const dialog = screen.getByRole('dialog', { name: /estado/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Abierto' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(screen.getByText('5 tickets actualizados')).toBeInTheDocument());
  });

  it('Cerrar success → "N tickets cerrados"', async () => {
    statusAsync.mockResolvedValue({});
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.getByText('5 tickets cerrados')).toBeInTheDocument());
  });

  it('partial failure carries the action verb → "X de N no se pudieron cerrar"', async () => {
    statusAsync.mockImplementation(({ id }: { id: string }) =>
      id === 't2' ? Promise.reject(new Error('boom')) : Promise.resolve({}));
    setup();
    selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.getByText('1 de 5 no se pudieron cerrar')).toBeInTheDocument());
  });
});
