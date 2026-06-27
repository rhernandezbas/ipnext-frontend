import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TicketFilterBar } from '@/pages/tickets/TicketsListPage/components/TicketFilterBar';
import type { TicketFilter } from '@/pages/tickets/TicketsListPage/hooks/useTicketsFilterUrl';

// Mock hooks
vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/hooks/useRbacUsers');
vi.mock('@/hooks/useTicketAreas');

import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useTicketAreasModule from '@/hooks/useTicketAreas';
import type { TicketStatus as TicketStatusType } from '@/types/ticketStatus';
import type { TicketArea } from '@/types/ticketArea';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

const mockStatuses: TicketStatusType[] = [
  { id: '1', name: 'Abierto', color: '#22c55e', weight: 1 },
  { id: '2', name: 'Cerrado', color: '#6b7280', weight: 2 },
];

const mockUsers: import('@/types/rbacUser').RbacUserWithRolesDto[] = [
  { id: 'u1', name: 'Ana García', roles: [], email: 'test@test.com', login: 'user1', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', lastLoginAt: null },
  { id: 'u2', name: 'Luis Pérez', roles: [], email: 'test2@test.com', login: 'user2', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', lastLoginAt: null },
];

const mockAreas: TicketArea[] = [
  { id: 'a1', name: 'Soporte', color: '#3b82f6' },
  { id: 'a2', name: 'Facturacion', color: '#3b82f6' },
];

function renderBar(filter: TicketFilter = {}, onFilterChange = vi.fn(), variant?: 'horizontal' | 'vertical') {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="*"
          element={<TicketFilterBar filter={filter} onFilterChange={onFilterChange} variant={variant} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('TicketFilterBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue(mockQuery({
      data: mockUsers,
      isLoading: false,
    }));
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: mockAreas,
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
  });

  it('renders Estado select populated from catalog (not hardcoded)', () => {
    renderBar();
    const estadoSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(estadoSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Abierto' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cerrado' })).toBeInTheDocument();
  });

  it('does NOT have hardcoded "Resuelto" or "Pendiente" options in Estado', () => {
    renderBar();
    expect(screen.queryByRole('option', { name: 'Resuelto' })).not.toBeInTheDocument();
  });

  it('renders Prioridad select with Alta/Media/Baja options', () => {
    renderBar();
    const select = screen.getByRole('combobox', { name: /prioridad/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Media' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Baja' })).toBeInTheDocument();
  });

  it('renders Asignado select populated from useRbacUsers', () => {
    renderBar();
    const select = screen.getByRole('combobox', { name: /asignado/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana García' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Luis Pérez' })).toBeInTheDocument();
  });

  it('renders Búsqueda text input', () => {
    renderBar();
    expect(screen.getByRole('searchbox', { name: /buscar/i })).toBeInTheDocument();
  });

  it('renders Desde/Hasta date inputs for período', () => {
    renderBar();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it('calls onFilterChange with status when Estado changes', () => {
    const onFilterChange = vi.fn();
    renderBar({}, onFilterChange);
    fireEvent.change(screen.getByRole('combobox', { name: /estado/i }), {
      target: { value: 'Abierto' },
    });
    expect(onFilterChange).toHaveBeenCalledWith({ status: 'Abierto' });
  });

  it('calls onFilterChange with undefined when Estado reset to empty', () => {
    const onFilterChange = vi.fn();
    renderBar({ status: 'Abierto' }, onFilterChange);
    fireEvent.change(screen.getByRole('combobox', { name: /estado/i }), {
      target: { value: '' },
    });
    expect(onFilterChange).toHaveBeenCalledWith({ status: undefined });
  });

  it('calls onFilterChange with priority when Prioridad changes', () => {
    const onFilterChange = vi.fn();
    renderBar({}, onFilterChange);
    fireEvent.change(screen.getByRole('combobox', { name: /prioridad/i }), {
      target: { value: 'high' },
    });
    expect(onFilterChange).toHaveBeenCalledWith({ priority: 'high' });
  });

  it('shows active chip for status filter', () => {
    renderBar({ status: 'Abierto' });
    // The chipList should contain "Abierto" as a chip (not just as a select option)
    const chipList = screen.getByRole('list', { name: /filtros activos/i });
    expect(chipList).toBeInTheDocument();
    expect(chipList.textContent).toMatch(/Abierto/);
  });

  it('shows "Limpiar filtros" when filter is active', () => {
    renderBar({ status: 'Abierto' });
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });

  it('does NOT show "Limpiar filtros" when no active filter', () => {
    renderBar({});
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
  });

  it('clicking chip × calls onFilterChange to clear that filter', () => {
    const onFilterChange = vi.fn();
    renderBar({ status: 'Abierto' }, onFilterChange);
    const removeBtn = screen.getByRole('button', { name: /quitar/i });
    fireEvent.click(removeBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ status: undefined });
  });

  it('clicking "Limpiar filtros" clears all filters', () => {
    const onFilterChange = vi.fn();
    renderBar({ status: 'Abierto', priority: 'high' }, onFilterChange);
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(onFilterChange).toHaveBeenCalledWith({
      status: undefined,
      priority: undefined,
      assignedTo: undefined,
      q: undefined,
      customerId: undefined,
      from: undefined,
      to: undefined,
      areaId: undefined,
    });
  });

  // ── Area filter — #49 (lesson #27: catalog-driven, no hardcoded list) ────────
  it('renders Area select populated from catalog (useTicketAreas)', () => {
    renderBar();
    const areaSelect = screen.getByRole('combobox', { name: /area/i });
    expect(areaSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Facturacion' })).toBeInTheDocument();
  });

  it('calls onFilterChange with areaId when Area select changes', () => {
    const onFilterChange = vi.fn();
    renderBar({}, onFilterChange);
    fireEvent.change(screen.getByRole('combobox', { name: /area/i }), {
      target: { value: 'a1' },
    });
    expect(onFilterChange).toHaveBeenCalledWith({ areaId: 'a1' });
  });

  it('calls onFilterChange with undefined when Area reset to empty', () => {
    const onFilterChange = vi.fn();
    renderBar({ areaId: 'a1' }, onFilterChange);
    fireEvent.change(screen.getByRole('combobox', { name: /area/i }), {
      target: { value: '' },
    });
    expect(onFilterChange).toHaveBeenCalledWith({ areaId: undefined });
  });

  it('shows area chip with name resolved from catalog', () => {
    renderBar({ areaId: 'a1' });
    const chipList = screen.getByRole('list', { name: /filtros activos/i });
    expect(chipList.textContent).toMatch(/Soporte/);
  });

  // ── Vertical (right-side panel) variant — FIX 3 ──────────────────────────────
  describe('vertical variant (right-side panel)', () => {
    it('renders a "Filtros" panel heading when variant=vertical', () => {
      renderBar({}, vi.fn(), 'vertical');
      expect(screen.getByRole('heading', { name: /filtros/i })).toBeInTheDocument();
    });

    it('does NOT render the panel heading in the default horizontal variant', () => {
      renderBar({}, vi.fn());
      expect(screen.queryByRole('heading', { name: /^filtros$/i })).not.toBeInTheDocument();
    });

    it('keeps all controls (Estado, Prioridad, Asignado, Búsqueda) in vertical layout', () => {
      renderBar({}, vi.fn(), 'vertical');
      expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /asignado/i })).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: /buscar/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    });
  });
});
