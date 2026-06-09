import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { DepotStockDTO } from '@/types/depot';

vi.mock('@/hooks/useDepotStock', () => ({
  useDepotStock: vi.fn(),
}));

import { useDepotStock } from '@/hooks/useDepotStock';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import InventoryDepotPage from '@/pages/inventory/InventoryDepotPage';
import { RequirePermission } from '@/components/auth/RequirePermission';

const populated: DepotStockDTO = {
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
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable-utp', label: 'Cable UTP Cat6', unit: 'm', qty: 120 },
  ],
  depotLocationId: 'loc-depot',
};

const emptyDepot: DepotStockDTO = { assets: [], materials: [], depotLocationId: null };

function renderPage(node: ReactNode = <InventoryDepotPage />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryDepotPage — populated', () => {
  beforeEach(() => {
    vi.mocked(useDepotStock).mockReturnValue({
      data: populated,
      isLoading: false,
      isError: false,
    } as never);
  });

  it('renders the "Equipos disponibles" section with its assets', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /equipos disponibles/i });
    expect(within(section).getByText('SN-AAA-001')).toBeInTheDocument();
    expect(within(section).getByText(/ONT Huawei/i)).toBeInTheDocument();
  });

  it('renders the "Materiales" section with its materials and quantities', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /materiales/i });
    expect(within(section).getByText(/Cable UTP Cat6/i)).toBeInTheDocument();
    expect(within(section).getByText(/120/)).toBeInTheDocument();
  });
});

describe('InventoryDepotPage — empty depot (contextual empty states)', () => {
  beforeEach(() => {
    vi.mocked(useDepotStock).mockReturnValue({
      data: emptyDepot,
      isLoading: false,
      isError: false,
    } as never);
  });

  it('shows an equipment empty state that mentions returns to the depot (retiros, Wave 4)', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /equipos disponibles/i });
    expect(within(section).getByText(/retiro/i)).toBeInTheDocument();
  });

  it('shows a materials empty state that mentions stock appearing once materials are stocked', () => {
    renderPage();
    const section = screen.getByRole('region', { name: /materiales/i });
    expect(within(section).getByText(/cuando se cargue stock/i)).toBeInTheDocument();
  });
});

describe('InventoryDepotPage — permission gating', () => {
  it('renders NoPermissionPage instead of the depot when the user lacks inventory.read', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    } as never);
    vi.mocked(useDepotStock).mockReturnValue({
      data: emptyDepot,
      isLoading: false,
      isError: false,
    } as never);

    renderPage(
      <RequirePermission permission="inventory.read">
        <InventoryDepotPage />
      </RequirePermission>,
    );

    expect(screen.getByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /equipos disponibles/i })).not.toBeInTheDocument();
  });
});
