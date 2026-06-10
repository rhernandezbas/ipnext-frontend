import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { DepotStockDTO } from '@/types/depot';

vi.mock('@/hooks/useDepotStock', () => ({
  useDepotStock: vi.fn(),
  DEPOT_STOCK_QUERY_KEY: ['inventory', 'depot'],
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

// Shallow-mock the modals so we don't need their dependencies in page tests
vi.mock('@/components/inventory/AddDepotAssetModal', () => ({
  AddDepotAssetModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Agregar equipo">
        <button onClick={onClose}>Cerrar asset modal</button>
      </div>
    ) : null,
}));

vi.mock('@/components/inventory/LoadDepotMaterialModal', () => ({
  LoadDepotMaterialModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Cargar material">
        <button onClick={onClose}>Cerrar material modal</button>
      </div>
    ) : null,
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

function withWrite() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: ['inventory.read', 'inventory.write'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some(p => ['inventory.read', 'inventory.write', '*'].includes(p));
    },
  } as never);
}

function withoutWrite() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: ['inventory.read'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some(p => p === 'inventory.read');
    },
  } as never);
}

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
  withWrite();
});

// ─── Populated depot ──────────────────────────────────────────────────────────

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

// ─── Empty depot ──────────────────────────────────────────────────────────────

describe('InventoryDepotPage — empty depot with inventory.write', () => {
  beforeEach(() => {
    vi.mocked(useDepotStock).mockReturnValue({
      data: emptyDepot,
      isLoading: false,
      isError: false,
    } as never);
    withWrite();
  });

  it('shows the updated empty state inviting to load stock', () => {
    renderPage();
    expect(screen.getAllByText(/El depósito está vacío/i).length).toBeGreaterThan(0);
  });

  it('shows "Agregar equipo" button in the header for users with inventory.write', () => {
    renderPage();
    // Multiple buttons may exist (header + empty state) — we just need at least one
    expect(screen.getAllByRole('button', { name: /Agregar equipo/i }).length).toBeGreaterThan(0);
  });

  it('shows "Cargar material" button in the header for users with inventory.write', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: /Cargar material/i }).length).toBeGreaterThan(0);
  });

  it('opens the AddDepotAssetModal when "Agregar equipo" header button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click the header button (first one with this name)
    const buttons = screen.getAllByRole('button', { name: /Agregar equipo/i });
    await user.click(buttons[0]);

    expect(screen.getByRole('dialog', { name: /Agregar equipo/i })).toBeInTheDocument();
  });

  it('opens the LoadDepotMaterialModal when "Cargar material" header button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const buttons = screen.getAllByRole('button', { name: /Cargar material/i });
    await user.click(buttons[0]);

    expect(screen.getByRole('dialog', { name: /Cargar material/i })).toBeInTheDocument();
  });
});

describe('InventoryDepotPage — empty depot WITHOUT inventory.write', () => {
  beforeEach(() => {
    vi.mocked(useDepotStock).mockReturnValue({
      data: emptyDepot,
      isLoading: false,
      isError: false,
    } as never);
    withoutWrite();
  });

  it('does NOT show the "Agregar equipo" or "Cargar material" header buttons', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /Agregar equipo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cargar material/i })).not.toBeInTheDocument();
  });

  it('shows an informational empty state without action buttons in sections', () => {
    renderPage();
    // Sections exist but have no "Agregar" / "Cargar" action buttons inside
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
  });
});

// ─── Permission gating ────────────────────────────────────────────────────────

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
