import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { TechnicianStockDTO } from '@/types/technician';

vi.mock('@/hooks/useTechnicianStock', () => ({
  useTechnicianStock: vi.fn(),
  useIssueStock: vi.fn(),
  TECHNICIAN_STOCK_QUERY_KEY: (id: string) => ['inventory', 'technician', id, 'stock'],
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

// The modal is exercised in its own test; stub it so the page test stays focused.
vi.mock('@/components/inventory/AssignStockModal', () => ({
  AssignStockModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="assign-modal">modal</div> : null,
}));

import { useTechnicianStock } from '@/hooks/useTechnicianStock';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import InventoryTechnicianPage from '@/pages/inventory/InventoryTechnicianPage';

const populated: TechnicianStockDTO = {
  assets: [
    {
      id: 'a1',
      serialNumber: 'SN-AAA-001',
      mac: 'AA:BB:CC:DD:EE:FF',
      deviceTypeId: 'dt1',
      deviceTypeName: 'ont',
      deviceTypeLabel: 'ONT Huawei',
      status: 'available',
      sourceTaskId: 't1',
    },
  ],
  materials: [
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable-utp', label: 'Cable UTP Cat6', unit: 'm', qty: 80 },
  ],
  locationId: 'loc-tecnico',
};

const emptyStock: TechnicianStockDTO = { assets: [], materials: [], locationId: null };

function mockCan(allowed: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: allowed,
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) =>
      (Array.isArray(p) ? p : [p]).some(x => allowed.includes(x)),
  } as never);
}

function renderPage(node: ReactNode = <InventoryTechnicianPage />, id = 'tech-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/inventory/technicians/${id}`]}>
        <Routes>
          <Route path="/admin/inventory/technicians/:id" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan(['inventory.read', 'inventory.write']);
});

describe('InventoryTechnicianPage — populated', () => {
  beforeEach(() => {
    vi.mocked(useTechnicianStock).mockReturnValue({
      data: populated,
      isLoading: false,
      isError: false,
    } as never);
  });

  it('renders the "Equipos asignados" section with the technician assets', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /equipos asignados/i });
    expect(within(section).getByText('SN-AAA-001')).toBeInTheDocument();
    expect(within(section).getByText(/ONT Huawei/i)).toBeInTheDocument();
  });

  it('renders the "Materiales" section with quantities', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /materiales/i });
    expect(within(section).getByText(/Cable UTP Cat6/i)).toBeInTheDocument();
    expect(within(section).getByText(/80/)).toBeInTheDocument();
  });
});

describe('InventoryTechnicianPage — empty (primary UX)', () => {
  beforeEach(() => {
    vi.mocked(useTechnicianStock).mockReturnValue({
      data: emptyStock,
      isLoading: false,
      isError: false,
    } as never);
  });

  it('shows a contextual empty state mentioning assigning stock from the depot', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /equipos asignados/i });
    expect(within(section).getByText(/desde el depósito/i)).toBeInTheDocument();
  });
});

describe('InventoryTechnicianPage — "Asignar stock" action', () => {
  beforeEach(() => {
    vi.mocked(useTechnicianStock).mockReturnValue({
      data: emptyStock,
      isLoading: false,
      isError: false,
    } as never);
  });

  it('shows the "Asignar stock" button when the user has inventory.write', () => {
    mockCan(['inventory.read', 'inventory.write']);
    renderPage();
    expect(screen.getByRole('button', { name: /asignar stock/i })).toBeInTheDocument();
  });

  it('hides the "Asignar stock" button when the user lacks inventory.write', () => {
    mockCan(['inventory.read']);
    renderPage();
    expect(screen.queryByRole('button', { name: /asignar stock/i })).not.toBeInTheDocument();
  });

  it('opens the AssignStockModal when the button is clicked', () => {
    mockCan(['inventory.read', 'inventory.write']);
    renderPage();
    expect(screen.queryByTestId('assign-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /asignar stock/i }));
    expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
  });
});
