import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// GR sync body hooks. Stable references — ConfigSection has a useEffect([config])
// that would loop forever if `data` were a fresh object each render. Declared via
// vi.hoisted so the hoisted vi.mock factories can reference them.
const grSyncHandles = vi.hoisted(() => ({
  config: { data: { intervalMs: 300_000, estados: ['1'] }, isLoading: false, isError: false, refetch: () => {} },
  update: { mutate: () => {}, isPending: false, isSuccess: false, isError: false, error: null, reset: () => {} },
  flag: { data: { key: 'gestion-real-sync', enabled: false }, isLoading: false, isError: false },
  setFlag: { mutate: () => {}, isPending: false, isError: false },
  status: { data: { lastRunAt: null, itemsSynced: 0, hasRun: false }, isLoading: false, isError: false },
  resyncAll: { mutate: () => {}, isPending: false, isSuccess: false, isError: false, error: null, reset: () => {} },
  clientStats: { data: undefined, isLoading: false, isError: false },
  confirmFn: () => Promise.resolve(false),
}));
vi.mock('@/hooks/useGestionRealSyncConfig', () => ({
  useSyncConfig: () => grSyncHandles.config,
  useUpdateSyncConfig: () => grSyncHandles.update,
  useResyncAll: () => grSyncHandles.resyncAll,
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: () => grSyncHandles.flag,
  useSetFeatureFlag: () => grSyncHandles.setFlag,
}));
vi.mock('@/hooks/useGestionRealSync', () => ({
  useGestionRealSyncStatus: () => grSyncHandles.status,
}));
vi.mock('@/hooks/useCustomers', () => ({
  useClientStats: () => grSyncHandles.clientStats,
}));
// ServiceCatalogBody (servicios tab) hooks — only exercised when that tab mounts.
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: () => ({ data: [], isLoading: false }),
  useCreateServiceCatalog: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateServiceCatalog: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteServiceCatalog: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => grSyncHandles.confirmFn,
}));
// GigaredTvBody hooks — only exercised when the Gigared TV tab mounts.
vi.mock('@/hooks/useGigared', () => ({
  useGigaredConfig: () => ({
    data: { configured: false, apiKeyLast4: null, baseUrl: 'https://x', enabled: false, updatedAt: null },
    isLoading: false,
    isError: false,
  }),
  useUpdateGigaredConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/api/gigared.api', () => ({ gigaredApi: { getSummary: vi.fn() } }));

const permHandle = vi.hoisted(() => ({ can: (_: string | string[]): boolean => true }));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ can: permHandle.can, isLoading: false, isError: false }),
}));

import CustomersSettingsPage from '@/pages/customers/CustomersSettingsPage';

function renderPage() {
  return render(<CustomersSettingsPage />);
}

describe('CustomersSettingsPage', () => {
  beforeEach(() => {
    window.location.hash = '';
    permHandle.can = () => true; // default: user has contracts.read
  });

  it('renders a single Configuración level-1 heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument();
  });

  it('renders the "Sincronización GR" tab as the first/default tab', () => {
    renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].textContent).toBe('Sincronización GR');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the "Tecnologías" tab when the user has contracts.read', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Tecnologías' })).toBeInTheDocument();
  });

  it('hides the "Tecnologías" tab when the user lacks contracts.read', () => {
    permHandle.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return !perms.includes('contracts.read');
    };
    renderPage();
    expect(screen.queryByRole('tab', { name: 'Tecnologías' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sincronización GR' })).toBeInTheDocument();
  });

  it('mounting the page shows the GR body (Configuración section + activación toggle) and sets the hash', () => {
    renderPage();
    // gr-sync is the default tab → body mounts immediately.
    expect(screen.getByRole('heading', { level: 3, name: /configuración/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/activar sincronización/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#gr-sync');
  });

  it('selecting the "Sincronización GR" tab keeps it selected and sets #gr-sync', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Sincronización GR' }));
    expect(screen.getByRole('tab', { name: 'Sincronización GR' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#gr-sync');
  });

  it('deep-link #gr-sync opens directly on the GR sync tab', () => {
    window.location.hash = '#gr-sync';
    renderPage();
    expect(screen.getByRole('tab', { name: 'Sincronización GR' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/activar sincronización/i)).toBeInTheDocument();
  });

  // --- CTU-9: Servicios tab gated by clients.manage ---
  it('shows the "Servicios" tab when the user has clients.manage', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Servicios' })).toBeInTheDocument();
  });

  it('hides the "Servicios" tab when the user lacks clients.manage', () => {
    permHandle.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return !perms.includes('clients.manage');
    };
    renderPage();
    expect(screen.queryByRole('tab', { name: 'Servicios' })).not.toBeInTheDocument();
  });

  it('deep-link #servicios activates the Servicios tab and mounts the catalog body', () => {
    window.location.hash = '#servicios';
    renderPage();
    expect(screen.getByRole('tab', { name: 'Servicios' })).toHaveAttribute('aria-selected', 'true');
    // ServiceCatalogBody empty state proves the body mounted.
    expect(screen.getByText(/no hay servicios/i)).toBeInTheDocument();
  });

  // --- #47: Gigared TV tab gated by tv.manage ---
  it('shows the "Gigared TV" tab when the user has tv.manage', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Gigared TV' })).toBeInTheDocument();
  });

  it('hides the "Gigared TV" tab when the user lacks tv.manage', () => {
    permHandle.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return !perms.includes('tv.manage');
    };
    renderPage();
    expect(screen.queryByRole('tab', { name: 'Gigared TV' })).not.toBeInTheDocument();
  });

  it('deep-link #gigared activates the Gigared TV tab and mounts the body', () => {
    window.location.hash = '#gigared';
    renderPage();
    expect(screen.getByRole('tab', { name: 'Gigared TV' })).toHaveAttribute('aria-selected', 'true');
    // GigaredTvBody status text proves the body mounted.
    expect(screen.getByText(/sin configurar/i)).toBeInTheDocument();
  });

  // --- recapture-admin-assign: Vendedores GR tab gated by recapture.assign ---
  it('shows the "Vendedores GR" tab when the user has recapture.assign', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Vendedores GR' })).toBeInTheDocument();
  });

  it('hides the "Vendedores GR" tab when the user lacks recapture.assign', () => {
    permHandle.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return !perms.includes('recapture.assign');
    };
    renderPage();
    expect(screen.queryByRole('tab', { name: 'Vendedores GR' })).not.toBeInTheDocument();
  });
});
