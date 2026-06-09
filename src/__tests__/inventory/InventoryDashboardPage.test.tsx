import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mock hooks ---
vi.mock('@/hooks/useInventoryDashboard', () => ({
  useInventoryOverview: vi.fn(),
  useInventoryMovements: vi.fn(),
  useInventoryAlerts: vi.fn(),
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import { useInventoryOverview, useInventoryMovements, useInventoryAlerts } from '@/hooks/useInventoryDashboard';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { InventoryOverviewDTO } from '@/types/inventoryDashboard';
import type { InventoryMovementListDTO } from '@/types/inventoryDashboard';
import type { LowStockAlertDTO } from '@/types/inventoryDashboard';

// --- Helpers ---

const emptyOverview: InventoryOverviewDTO = {
  groups: [
    { type: 'DEPOSITO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    { type: 'CLIENTE', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    { type: 'TECNICO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    { type: 'CAMIONETA', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
  ],
};

const twoLocationsOverview: InventoryOverviewDTO = {
  groups: [
    {
      type: 'DEPOSITO',
      locationCount: 1,
      totalAssets: 5,
      totalMaterialQty: 20,
      locations: [
        { locationId: 'loc-1', label: 'Depósito', assetCount: 5, materialQty: 20 },
      ],
    },
    {
      type: 'CLIENTE',
      locationCount: 1,
      totalAssets: 2,
      totalMaterialQty: 10,
      locations: [
        { locationId: 'loc-2', label: 'Cliente ABC', assetCount: 2, materialQty: 10 },
      ],
    },
    { type: 'TECNICO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    { type: 'CAMIONETA', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
  ],
};

const emptyMovements: InventoryMovementListDTO = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
};

const emptyAlerts: LowStockAlertDTO[] = [];

const twoAlerts: LowStockAlertDTO[] = [
  { materialCatalogId: 'mat-1', name: 'CABLE', label: 'Cable coaxial', unit: 'm', totalQty: 3, minStock: 10, deficit: 7 },
  { materialCatalogId: 'mat-2', name: 'CONECTOR', label: null, unit: 'u', totalQty: 1, minStock: 5, deficit: 4 },
];

function mockAllPerms() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: ['inventory.read'],
    isLoading: false,
    isError: false,
    can: (perms: string | string[]) => {
      const arr = Array.isArray(perms) ? perms : [perms];
      return arr.includes('inventory.read') || arr.includes('inventory.manage');
    },
  });
}

function mockNoPerms() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => false,
  });
}

function mockOverview(data: InventoryOverviewDTO, isLoading = false) {
  vi.mocked(useInventoryOverview).mockReturnValue({ data, isLoading } as ReturnType<typeof useInventoryOverview>);
}

function mockMovements(data: InventoryMovementListDTO, isLoading = false) {
  vi.mocked(useInventoryMovements).mockReturnValue({ data, isLoading } as ReturnType<typeof useInventoryMovements>);
}

function mockAlerts(data: LowStockAlertDTO[], isLoading = false) {
  vi.mocked(useInventoryAlerts).mockReturnValue({ data, isLoading } as ReturnType<typeof useInventoryAlerts>);
}

import InventoryDashboardPage from '@/pages/inventory/InventoryDashboardPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryDashboardPage />
    </MemoryRouter>,
  );
}

// SCEN-FE-1: Ubicaciones tab with 2 locations renders them correctly
describe('SCEN-FE-1: Ubicaciones tab with 2 locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(twoLocationsOverview);
    mockMovements(emptyMovements);
    mockAlerts(emptyAlerts);
  });

  it('renders Ubicaciones tab by default and shows Depósito section', () => {
    renderPage();
    // The page has the Ubicaciones tab
    expect(screen.getByRole('tab', { name: /ubicaciones/i })).toBeInTheDocument();
    // Depot section header is shown (h3)
    expect(screen.getByRole('heading', { name: 'Depósito', level: 3 })).toBeInTheDocument();
  });

  it('CLIENTE group collapses to summary row when there are CLIENTE locations', () => {
    renderPage();
    // Should show "1 clientes con stock" summary row, not individual cards
    expect(screen.getByText(/1 clientes? con stock/i)).toBeInTheDocument();
  });

  it('shows TECNICO and CAMIONETA empty state (sin stock)', () => {
    renderPage();
    // Empty types should still render section with muted "Sin stock" text
    const sinStockEls = screen.getAllByText(/sin stock/i);
    expect(sinStockEls.length).toBeGreaterThanOrEqual(2); // TECNICO + CAMIONETA
  });
});

// SCEN-FE-2: Empty state for Ubicaciones tab
describe('SCEN-FE-2: Ubicaciones empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
    mockAlerts(emptyAlerts);
  });

  it('shows empty state message when no location has content', () => {
    renderPage();
    expect(screen.getByText(/El depósito no tiene stock cargado/i)).toBeInTheDocument();
  });
});

// SCEN-FE-3: Alertas tab badge shows count
describe('SCEN-FE-3: Alertas tab badge with count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
    mockAlerts(twoAlerts);
  });

  it('Alertas tab label shows badge with 2', () => {
    renderPage();
    // The tab label should contain the count
    const alertsTab = screen.getByRole('tab', { name: /alertas/i });
    expect(alertsTab).toBeInTheDocument();
    expect(alertsTab.textContent).toMatch(/2/);
  });

  it('switching to Alertas tab shows deficit table', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /alertas/i }));
    expect(screen.getByText('CABLE')).toBeInTheDocument();
    expect(screen.getByText('CONECTOR')).toBeInTheDocument();
    // deficit column values
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

// SCEN-FE-4: 403 redirect for users without inventory.read
describe('SCEN-FE-4: 403 without inventory.read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNoPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
    mockAlerts(emptyAlerts);
  });

  it('does not render dashboard content when user lacks inventory.read', () => {
    renderPage();
    // Dashboard content (tabs) should not be visible
    expect(screen.queryByRole('tab', { name: /ubicaciones/i })).not.toBeInTheDocument();
  });
});

// SCEN-WA-1: World A routes should not render
describe('SCEN-WA-1: World A routes not registered in the page', () => {
  it('InventoryDashboardPage does not render any World A legacy content', () => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
    mockAlerts(emptyAlerts);
    renderPage();
    // The old World A heading should not exist
    expect(screen.queryByText('Dashboard de Inventario')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('KPI cards')).not.toBeInTheDocument();
  });
});

// Movimientos tab: filter bar and pagination
describe('Movimientos tab: filter bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
    mockAlerts(emptyAlerts);
  });

  it('shows Movimientos tab', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /movimientos/i })).toBeInTheDocument();
  });

  it('switching to Movimientos tab shows empty state message', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    expect(screen.getByText(/Sin movimientos para estos filtros/i)).toBeInTheDocument();
  });
});

// minStock in MaterialsBody (task 7.4 coverage is in MaterialsBody.test.tsx)
describe('Alertas empty state variants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllPerms();
    mockOverview(emptyOverview);
    mockMovements(emptyMovements);
  });

  it('shows "Sin alertas de stock bajo" when alerts configured but none triggered', async () => {
    const user = userEvent.setup();
    // alerts configured (non-zero minStock exists somewhere) but no triggered alert
    mockAlerts([]);
    renderPage();
    await user.click(screen.getByRole('tab', { name: /alertas/i }));
    expect(screen.getByText(/Sin alertas de stock bajo/i)).toBeInTheDocument();
  });
});
