/**
 * Tests for InventoryVehiclePage (EPIC #38, Wave 5b — SCEN-FE-4, SCEN-FE-5).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { VehicleStockDTO } from '@/types/vehicle';
import { useMyPermissions } from '@/hooks/useMyPermissions';

vi.mock('@/hooks/useVehicles', () => ({
  useVehicleStock: vi.fn(),
  useIssueStockToVehicle: vi.fn(),
  useVehicles: vi.fn(),
  useCreateVehicle: vi.fn(),
  useUpdateVehicle: vi.fn(),
  useDeleteVehicle: vi.fn(),
  VEHICLES_QUERY_KEY: ['inventory', 'vehicles'],
  VEHICLE_STOCK_QUERY_KEY: (id: string) => ['inventory', 'vehicles', id, 'stock'],
}));

vi.mock('@/hooks/useDepotStock', () => ({
  useDepotStock: vi.fn(() => ({ data: { assets: [], materials: [], depotLocationId: null }, isLoading: false })),
  DEPOT_STOCK_QUERY_KEY: ['inventory', 'depot'],
}));

import { useVehicleStock, useIssueStockToVehicle } from '@/hooks/useVehicles';
import InventoryVehiclePage from '@/pages/inventory/InventoryVehiclePage';

function makeStock(over: Partial<VehicleStockDTO> = {}): VehicleStockDTO {
  return {
    vehicleId: 'v-1',
    assets: [],
    materials: [],
    ...over,
  };
}

function renderVehiclePage(vehicleId = 'v-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/inventory/vehicles/${vehicleId}`]}>
      <Routes>
        <Route
          path="/admin/inventory/vehicles/:id"
          element={<InventoryVehiclePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InventoryVehiclePage — SCEN-FE-4: empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
    vi.mocked(useIssueStockToVehicle).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useIssueStockToVehicle>);
  });

  it('renders empty state when vehicle has no assets or materials', () => {
    vi.mocked(useVehicleStock).mockReturnValue({
      data: makeStock({ assets: [], materials: [] }),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);

    renderVehiclePage();

    expect(screen.getByText(/Sin equipos asignados/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin materiales asignados/i)).toBeInTheDocument();
  });

  it('does NOT show an error alert when stock is empty', () => {
    vi.mocked(useVehicleStock).mockReturnValue({
      data: makeStock({ assets: [], materials: [] }),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);

    renderVehiclePage();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useVehicleStock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);

    renderVehiclePage();
    const loadingEls = screen.getAllByText(/Cargando/i);
    expect(loadingEls.length).toBeGreaterThan(0);
  });
});

describe('InventoryVehiclePage — SCEN-FE-5: Asignar stock gated by inventory.write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVehicleStock).mockReturnValue({
      data: makeStock(),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);
    vi.mocked(useIssueStockToVehicle).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useIssueStockToVehicle>);
  });

  it('shows Asignar stock button when user has inventory.write', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });

    renderVehiclePage();
    expect(screen.getByRole('button', { name: /Asignar stock/i })).toBeInTheDocument();
  });

  it('hides Asignar stock button when user lacks inventory.write', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['inventory.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(perm => perm === 'inventory.read');
      },
    });

    renderVehiclePage();
    expect(screen.queryByRole('button', { name: /Asignar stock/i })).not.toBeInTheDocument();
  });

  it('opens AssignStockToVehicleModal when Asignar stock is clicked', async () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });

    const user = userEvent.setup();
    renderVehiclePage();

    await user.click(screen.getByRole('button', { name: /Asignar stock/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('InventoryVehiclePage — stock items rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
    vi.mocked(useIssueStockToVehicle).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useIssueStockToVehicle>);
  });

  it('renders asset rows when stock has assets', () => {
    vi.mocked(useVehicleStock).mockReturnValue({
      data: makeStock({
        assets: [{
          id: 'a-1',
          serialNumber: 'SN-001',
          deviceTypeName: 'ONU',
          deviceTypeLabel: 'Óptico',
          mac: null,
          status: 'assigned',
          currentLocationId: 'loc-1',
          materialCatalogId: null,
        }],
        materials: [],
      }),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);

    renderVehiclePage();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
  });

  it('renders material rows when stock has materials', () => {
    vi.mocked(useVehicleStock).mockReturnValue({
      data: makeStock({
        assets: [],
        materials: [{
          id: 'mb-1',
          materialCatalogId: 'mc-1',
          name: 'CABLE',
          label: 'Cable coaxial',
          unit: 'm',
          qty: 15,
          locationId: 'loc-1',
        }],
      }),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicleStock>);

    renderVehiclePage();
    expect(screen.getByText('Cable coaxial')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});
