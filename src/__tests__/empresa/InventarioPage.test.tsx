import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as InventarioPage } from '@/pages/empresa/InventarioPage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { InventoryProduct, InventoryUnit } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockProducts: InventoryProduct[] = [
  {
    id: 'prod-1',
    name: 'Router TP-Link',
    category: 'router',
    sku: 'RTR-001',
    description: 'Router doméstico',
    unitPrice: 8500,
    supplier: 'TP-Link',
    totalStock: 45,
    minStock: 10,
    status: 'in_stock',
  },
  {
    id: 'prod-2',
    name: 'Splitter PLC 1:8',
    category: 'splitter',
    sku: 'SPL-001',
    description: 'Splitter PLC',
    unitPrice: 1200,
    supplier: 'Divisores SA',
    totalStock: 8,
    minStock: 20,
    status: 'low_stock',
  },
];

const mockUnits: InventoryUnit[] = [
  {
    id: 'unit-1',
    productId: 'prod-1',
    productName: 'Router TP-Link',
    serialNumber: 'RTR-SN-001',
    barcode: 'BC-001',
    status: 'available',
    location: 'Almacén A',
    purchaseDate: '2025-01-10',
    purchasePrice: 7800,
    assignedToClientId: null,
    assignedAt: null,
    notes: '',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <InventarioPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InventarioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useEmpresaModule.useInventoryProducts).mockReturnValue({
      data: mockProducts,
      isLoading: false,
    } as ReturnType<typeof useEmpresaModule.useInventoryProducts>);

    vi.mocked(useEmpresaModule.useInventoryUnits).mockReturnValue({
      data: mockUnits,
      isLoading: false,
    } as ReturnType<typeof useEmpresaModule.useInventoryUnits>);

    vi.mocked(useEmpresaModule.useCreateInventoryUnit).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useCreateInventoryUnit>);

    vi.mocked(useEmpresaModule.useUpdateInventoryProduct).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useUpdateInventoryProduct>);

    vi.mocked(useEmpresaModule.useDeleteInventoryProduct).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useDeleteInventoryProduct>);

    vi.mocked(useEmpresaModule.useDeleteInventoryUnit).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useDeleteInventoryUnit>);

    vi.mocked(useEmpresaModule.useUpdateInventoryUnit).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useUpdateInventoryUnit>);
  });

  it('renders "Inventario" heading', () => {
    renderPage();
    expect(screen.getByText(/inventario/i)).toBeInTheDocument();
  });

  it('"Productos" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Productos' })).toBeInTheDocument();
  });

  it('"Ítems" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Ítems' })).toBeInTheDocument();
  });

  it('summary cards render', () => {
    renderPage();
    expect(screen.getByText('Total productos')).toBeInTheDocument();
    expect(screen.getAllByText('Stock bajo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sin stock')).toBeInTheDocument();
  });

  it('products table shows product names', () => {
    renderPage();
    expect(screen.getByText('Router TP-Link')).toBeInTheDocument();
    expect(screen.getByText('Splitter PLC 1:8')).toBeInTheDocument();
  });

  it('low stock alert banner shows when product is low_stock', () => {
    renderPage();
    expect(screen.getByText(/productos con stock bajo/i)).toBeInTheDocument();
  });

  it('switching to "Ítems" tab shows serial number column', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Ítems' }));

    expect(screen.getByRole('columnheader', { name: 'Nro. Serie' })).toBeInTheDocument();
  });
});
