/**
 * Tests for FIX 2 — Dashboard location links (TECNICO / CAMIONETA).
 *
 * Decision (evidenced from OverviewLocationDTO type):
 *   - OverviewLocationDTO has { locationId, label, assetCount, materialQty } ONLY.
 *   - It does NOT carry technicianId or vehicleId.
 *   - Therefore TECNICO rows link to the TECNICO LIST at /admin/inventory/technicians.
 *   - CAMIONETA rows link to /admin/inventory/settings#camionetas (config).
 *   - Direct per-id links require a BE follow-up to extend the DTO.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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
import type { InventoryOverviewDTO, InventoryMovementListDTO, LowStockAlertDTO } from '@/types/inventoryDashboard';

const overviewWithTecnicoAndCamioneta: InventoryOverviewDTO = {
  groups: [
    { type: 'DEPOSITO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    { type: 'CLIENTE', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    {
      type: 'TECNICO',
      locationCount: 2,
      totalAssets: 5,
      totalMaterialQty: 20,
      locations: [
        { locationId: 'loc-t1', label: 'Ana García', assetCount: 3, materialQty: 12 },
        { locationId: 'loc-t2', label: 'Carlos López', assetCount: 2, materialQty: 8 },
      ],
    },
    {
      type: 'CAMIONETA',
      locationCount: 1,
      totalAssets: 1,
      totalMaterialQty: 5,
      locations: [
        { locationId: 'loc-c1', label: 'Camioneta 01', assetCount: 1, materialQty: 5 },
      ],
    },
  ],
};

const emptyMovements: InventoryMovementListDTO = { items: [], total: 0, page: 1, limit: 25 };
const emptyAlerts: LowStockAlertDTO[] = [];

function mockPerms() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: ['inventory.read'],
    isLoading: false, isError: false,
    can: (p: string | string[]) => {
      const arr = Array.isArray(p) ? p : [p];
      return arr.includes('inventory.read');
    },
  });
}

import InventoryDashboardPage from '@/pages/inventory/InventoryDashboardPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryDashboardPage />
    </MemoryRouter>,
  );
}

describe('FIX 2 — Dashboard links for TECNICO rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    vi.mocked(useInventoryOverview).mockReturnValue({
      data: overviewWithTecnicoAndCamioneta,
      isLoading: false,
    } as ReturnType<typeof useInventoryOverview>);
    vi.mocked(useInventoryMovements).mockReturnValue({
      data: emptyMovements,
      isLoading: false,
    } as ReturnType<typeof useInventoryMovements>);
    vi.mocked(useInventoryAlerts).mockReturnValue({
      data: emptyAlerts,
      isLoading: false,
    } as ReturnType<typeof useInventoryAlerts>);
  });

  it('renders a "Ver todos" link for TECNICO pointing to /admin/inventory/technicians', () => {
    renderPage();
    // Find the link in the Técnicos section
    const links = screen.getAllByRole('link', { name: /ver todos/i });
    const tecnicoLink = links.find(l => l.getAttribute('href') === '/admin/inventory/technicians');
    expect(tecnicoLink).toBeDefined();
  });

  it('renders a "Ver todos" link for CAMIONETA pointing to /admin/inventory/settings#camionetas', () => {
    renderPage();
    const links = screen.getAllByRole('link', { name: /ver todos/i });
    const camionetaLink = links.find(l => l.getAttribute('href') === '/admin/inventory/settings#camionetas');
    expect(camionetaLink).toBeDefined();
  });

  it('still shows individual location rows for TECNICO without per-id links', () => {
    renderPage();
    // Location labels are visible (the rows are still rendered)
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
    // But there should be no link with /technicians/loc-t1 (no direct id linking)
    const directLinks = screen.queryAllByRole('link', { name: /ana/i });
    expect(directLinks.length).toBe(0);
  });
});

describe('FIX 2 — Dashboard links for TECNICO empty state', () => {
  it('renders "Ver todos" link for TECNICO even when no stock (0 locations)', () => {
    vi.clearAllMocks();
    mockPerms();
    const emptyTecnico: InventoryOverviewDTO = {
      groups: [
        { type: 'DEPOSITO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
        { type: 'CLIENTE', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
        { type: 'TECNICO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
        { type: 'CAMIONETA', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
      ],
    };
    vi.mocked(useInventoryOverview).mockReturnValue({
      data: emptyTecnico, isLoading: false,
    } as ReturnType<typeof useInventoryOverview>);
    vi.mocked(useInventoryMovements).mockReturnValue({
      data: emptyMovements, isLoading: false,
    } as ReturnType<typeof useInventoryMovements>);
    vi.mocked(useInventoryAlerts).mockReturnValue({
      data: emptyAlerts, isLoading: false,
    } as ReturnType<typeof useInventoryAlerts>);

    render(<MemoryRouter><InventoryDashboardPage /></MemoryRouter>);
    // Even empty, the "Ver todos" link for technicians should appear
    const links = screen.getAllByRole('link', { name: /ver todos/i });
    const tecnicoLink = links.find(l => l.getAttribute('href') === '/admin/inventory/technicians');
    expect(tecnicoLink).toBeDefined();
  });
});

// Verify switching tabs still works (regression)
describe('FIX 2 — regression: Movimientos tab still works', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    vi.mocked(useInventoryOverview).mockReturnValue({
      data: overviewWithTecnicoAndCamioneta,
      isLoading: false,
    } as ReturnType<typeof useInventoryOverview>);
    vi.mocked(useInventoryMovements).mockReturnValue({
      data: emptyMovements,
      isLoading: false,
    } as ReturnType<typeof useInventoryMovements>);
    vi.mocked(useInventoryAlerts).mockReturnValue({
      data: emptyAlerts,
      isLoading: false,
    } as ReturnType<typeof useInventoryAlerts>);
  });

  it('can switch to Movimientos tab after dashboard changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /movimientos/i }));
    expect(screen.getByText(/Sin movimientos para estos filtros/i)).toBeInTheDocument();
  });
});
