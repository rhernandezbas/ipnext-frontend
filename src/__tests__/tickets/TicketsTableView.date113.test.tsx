/**
 * #113 — "Creado" column: rename header + apply formatDateTimeShort.
 *
 * The header previously read "Creado de fecha y hora". It must now read "Creado".
 * The cell must render the canonical "DD mmm YYYY - HH:MM" format via the
 * formatDateTimeShort helper (src/utils/formatDate.ts), not the raw ISO string.
 *
 * The helper is NOT mocked — we test the real output to confirm integration.
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
    createdAt: '2025-09-08T13:45:00.000Z', updatedAt: '2025-09-08T13:45:00.000Z',
    resolvedAt: null, archivedAt: null, contractId: null, tags: [],
    ...over,
  };
}

describe('TicketsTableView — Creado column (#113)', () => {
  it('catalog entry for createdAt is labeled "Creado" (not "Creado de fecha y hora")', () => {
    const entry = ALL_TICKET_COLUMNS.find(c => c.key === 'createdAt');
    expect(entry).toBeDefined();
    expect(entry?.label).toBe('Creado');
  });

  it('renders the column header as "Creado"', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({})]}
          loading={false}
          visibleColumnKeys={ALL_TICKET_COLUMNS.map(c => c.key)}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('columnheader', { name: 'Creado' })).toBeInTheDocument();
    expect(screen.queryByText('Creado de fecha y hora')).not.toBeInTheDocument();
  });

  it('renders the date cell with formatDateTimeShort format ("DD mmm YYYY - HH:MM")', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({ createdAt: '2025-09-08T13:45:00.000Z' })]}
          loading={false}
          visibleColumnKeys={['createdAt']}
        />
      </MemoryRouter>,
    );
    // formatDateTimeShort('2025-09-08T13:45:00.000Z') → "08 sep 2025 - 13:45" (local time)
    // The exact time depends on host TZ but the date + sep month + year must be there.
    // We verify the structure: "08 sep 2025" substring is always present.
    const cell = screen.getByRole('cell', { name: /sep 2025/ });
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toMatch(/\d{2} sep 2025 - \d{2}:\d{2}/);
  });

  it('renders "—" for a null/undefined createdAt', () => {
    render(
      <MemoryRouter>
        <TicketsTableView
          tickets={[mkTicket({ createdAt: '' as unknown as string })]}
          loading={false}
          visibleColumnKeys={['createdAt']}
        />
      </MemoryRouter>,
    );
    // formatDateTimeShort('') → '—'
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
  });
});
