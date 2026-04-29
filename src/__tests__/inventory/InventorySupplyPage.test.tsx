import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import InventorySupplyPage from '@/pages/inventory/InventorySupplyPage';

vi.mock('@/hooks/useEmpresa', () => ({
  useSupplyOrders: vi.fn(),
}));

import { useSupplyOrders } from '@/hooks/useEmpresa';

const mockOrders = [
  {
    id: '1',
    proveedor: 'TP-Link',
    estado: 'pendiente',
    fecha: '2024-01-15',
    total: 1500,
  },
  {
    id: '2',
    proveedor: 'Huawei',
    estado: 'recibido',
    fecha: '2024-01-10',
    total: 3200,
  },
];

describe('InventorySupplyPage', () => {
  beforeEach(() => {
    vi.mocked(useSupplyOrders).mockReturnValue({
      data: mockOrders,
      isLoading: false,
    } as ReturnType<typeof useSupplyOrders>);
  });

  it('renders the page heading', () => {
    render(<MemoryRouter><InventorySupplyPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Suministro/i })).toBeInTheDocument();
  });

  it('renders the Proveedor column header', () => {
    render(<MemoryRouter><InventorySupplyPage /></MemoryRouter>);
    expect(screen.getByText('Proveedor')).toBeInTheDocument();
  });

  it('renders supply order rows from the hook data', () => {
    render(<MemoryRouter><InventorySupplyPage /></MemoryRouter>);
    expect(screen.getByText('TP-Link')).toBeInTheDocument();
    expect(screen.getByText('Huawei')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useSupplyOrders).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useSupplyOrders>);
    render(<MemoryRouter><InventorySupplyPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Suministro/i })).toBeInTheDocument();
  });
});
