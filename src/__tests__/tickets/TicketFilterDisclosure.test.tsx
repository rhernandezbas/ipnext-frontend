/**
 * #46 — TicketFilterDisclosure (AD-8).
 * Filters live behind a collapsible panel (closed by default) fronted by a
 * "Filtros" button carrying a badge with the active-filter count. The active
 * chips render OUTSIDE the panel and stay visible while it's closed; removing a
 * chip updates the filter WITHOUT opening the panel.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketStatuses', () => ({
  useTicketStatuses: () => ({ data: [{ id: 's1', name: 'Abierto', color: '#22c55e' }] }),
}));
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: () => ({ data: [{ id: 'u1', name: 'Luis' }] }),
}));

import { TicketFilterDisclosure } from '@/pages/tickets/TicketsListPage/components/TicketFilterDisclosure';
import type { TicketFilter } from '@/pages/tickets/TicketsListPage/hooks/useTicketsFilterUrl';

function setup(filter: TicketFilter, onFilterChange = vi.fn()) {
  render(<TicketFilterDisclosure filter={filter} onFilterChange={onFilterChange} />);
  return { onFilterChange };
}

describe('TicketFilterDisclosure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is collapsed by default — the filter controls are not rendered', () => {
    setup({});
    // The "Estado" select inside TicketFilterBar must not be in the DOM when closed.
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
  });

  it('shows a badge with the active-filter count', () => {
    setup({ status: 'Abierto', priority: 'high' });
    const toggle = screen.getByRole('button', { name: /Filtros/ });
    expect(toggle).toHaveTextContent('2');
  });

  it('no badge when there are no active filters', () => {
    setup({});
    const toggle = screen.getByRole('button', { name: /Filtros/ });
    expect(toggle.querySelector('[data-testid="filter-count-badge"]')).toBeNull();
  });

  it('clicking "Filtros" opens the panel and reveals the controls', () => {
    setup({});
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
  });

  it('chips are visible OUTSIDE the panel while it is closed', () => {
    setup({ status: 'Abierto' });
    // Panel closed → controls absent, but the chip for the active status is shown.
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filtros activos')).toBeInTheDocument();
    expect(screen.getByText('Abierto')).toBeInTheDocument();
  });

  it('removing a chip updates the filter WITHOUT opening the panel', () => {
    const { onFilterChange } = setup({ status: 'Abierto' });
    fireEvent.click(screen.getByRole('button', { name: /Quitar filtro Abierto/ }));
    expect(onFilterChange).toHaveBeenCalledWith({ status: undefined });
    // Panel stayed closed.
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
  });
});
