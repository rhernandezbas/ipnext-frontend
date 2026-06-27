/**
 * #69 — the LISTADO's Área column.
 *
 * The area renders as a colored pill (catalog color, inline on the ticket DTO as
 * areaColor) with an auto-contrasted text color, falling back to '—' when the
 * ticket has no area. The column must reach the table through the REAL
 * visibleColumnKeys path (ALL_TICKET_COLUMNS → table ALL_COLUMNS), so a key
 * mismatch (leccion #48) would make the column vanish and fail this test.
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

function renderWithCatalogColumns(ticket: Ticket) {
  return render(
    <MemoryRouter>
      <TicketsTableView
        tickets={[ticket]}
        loading={false}
        visibleColumnKeys={ALL_TICKET_COLUMNS.map(c => c.key)}
      />
    </MemoryRouter>,
  );
}

describe('TicketsTableView — Área column (#69)', () => {
  it('is present in the default column catalog (visible by default)', () => {
    expect(ALL_TICKET_COLUMNS.some(c => c.key === 'areaName' && c.label === 'Área')).toBe(true);
  });

  it('renders the area as a pill through the real visibleColumnKeys path', () => {
    renderWithCatalogColumns(mkTicket({ areaId: 'a1', areaName: 'Soporte', areaColor: '#6366f1' }));
    // Header reaches the table → catalog key matches table key (#48 guard).
    expect(screen.getByText('Área')).toBeInTheDocument();
    const pill = screen.getByLabelText('Área: Soporte');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Soporte');
    // Catalog color drives the pill background.
    expect(pill).toHaveStyle({ backgroundColor: '#6366f1' });
  });

  it('uses a legible (light) text color on a light area color', () => {
    renderWithCatalogColumns(mkTicket({ areaId: 'a2', areaName: 'Administración', areaColor: '#f59e0b' }));
    const pill = screen.getByLabelText('Área: Administración');
    // Amber background → dark text for contrast (not white).
    expect(pill).toHaveStyle({ color: '#111827' });
  });

  it('falls back to "—" when the ticket has no area', () => {
    // Give reporterName a value so the only '—' on screen is the Área cell.
    renderWithCatalogColumns(
      mkTicket({ reporterName: 'Quien Sea', areaId: null, areaName: null, areaColor: null }),
    );
    expect(screen.getByText('Área')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
