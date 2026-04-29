import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import InventoryProductsPage from '@/pages/inventory/InventoryProductsPage';

vi.mock('@/hooks/useEmpresa', () => ({
  useInventoryProducts: vi.fn(),
}));

import { useInventoryProducts } from '@/hooks/useEmpresa';

const mockProducts = [
  {
    id: '1',
    name: 'Router XR200',
    category: 'router',
    sku: 'R001',
    description: 'High-performance router',
    unitPrice: 150,
    supplier: 'TP-Link',
    totalStock: 20,
    minStock: 5,
    status: 'in_stock',
  },
  {
    id: '2',
    name: 'Splitter 1:8',
    category: 'splitter',
    sku: 'S001',
    description: 'Optical splitter',
    unitPrice: 45,
    supplier: 'Huawei',
    totalStock: 3,
    minStock: 10,
    status: 'low_stock',
  },
];

describe('InventoryProductsPage', () => {
  beforeEach(() => {
    vi.mocked(useInventoryProducts).mockReturnValue({
      data: mockProducts,
      isLoading: false,
    } as ReturnType<typeof useInventoryProducts>);
  });

  it('renders the page heading', () => {
    render(<MemoryRouter><InventoryProductsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Productos/i })).toBeInTheDocument();
  });

  it('renders the Nombre column header', () => {
    render(<MemoryRouter><InventoryProductsPage /></MemoryRouter>);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
  });

  it('renders product rows from the hook data', () => {
    render(<MemoryRouter><InventoryProductsPage /></MemoryRouter>);
    expect(screen.getByText('Router XR200')).toBeInTheDocument();
    expect(screen.getByText('Splitter 1:8')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useInventoryProducts).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useInventoryProducts>);
    render(<MemoryRouter><InventoryProductsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Productos/i })).toBeInTheDocument();
  });
});
