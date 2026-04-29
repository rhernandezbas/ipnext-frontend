import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import InventoryDashboardPage from '@/pages/inventory/InventoryDashboardPage';

vi.mock('@/hooks/useEmpresa', () => ({
  useInventoryItems: vi.fn(),
}));

import { useInventoryItems } from '@/hooks/useEmpresa';

const mockItems = [
  { id: '1', name: 'Router X', category: 'router', sku: 'R1', quantity: 0, minStock: 5, unitPrice: 100, supplier: 'A', location: 'A1', status: 'out_of_stock' },
  { id: '2', name: 'Cable Y', category: 'cable', sku: 'C1', quantity: 2, minStock: 10, unitPrice: 20, supplier: 'B', location: 'B1', status: 'low_stock' },
  { id: '3', name: 'Splitter Z', category: 'splitter', sku: 'S1', quantity: 50, minStock: 5, unitPrice: 15, supplier: 'C', location: 'C1', status: 'in_stock' },
];

describe('InventoryDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useInventoryItems).mockReturnValue({
      data: mockItems,
      isLoading: false,
    } as ReturnType<typeof useInventoryItems>);
  });

  it('renders heading "Dashboard de Inventario"', () => {
    render(<MemoryRouter><InventoryDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Dashboard de Inventario/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useInventoryItems).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useInventoryItems>);
    render(<MemoryRouter><InventoryDashboardPage /></MemoryRouter>);
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('KPI "Sin stock" shows correct count', () => {
    render(<MemoryRouter><InventoryDashboardPage /></MemoryRouter>);
    const kpiGrid = screen.getByLabelText('KPI cards');
    expect(kpiGrid).toBeInTheDocument();
    // 1 out_of_stock item
    const sinStockLabel = screen.getByText('Sin stock');
    const kpiCard = sinStockLabel.closest('[class*="kpiCard"]');
    const valueEl = kpiCard?.querySelector('[class*="kpiValue"]');
    expect(valueEl?.textContent).toBe('1');
  });

  it('DataTable shows only low/out_of_stock items', () => {
    render(<MemoryRouter><InventoryDashboardPage /></MemoryRouter>);
    expect(screen.getByText('Router X')).toBeInTheDocument();
    expect(screen.getByText('Cable Y')).toBeInTheDocument();
    expect(screen.queryByText('Splitter Z')).not.toBeInTheDocument();
  });
});
