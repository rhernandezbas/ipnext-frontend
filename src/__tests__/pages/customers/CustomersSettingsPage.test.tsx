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
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => grSyncHandles.confirmFn,
}));

import CustomersSettingsPage from '@/pages/customers/CustomersSettingsPage';

function renderPage() {
  return render(<CustomersSettingsPage />);
}

describe('CustomersSettingsPage', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders a single Configuración level-1 heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument();
  });

  it('renders the "Sincronización GR" tab as the first/default tab', () => {
    renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Sincronización GR']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
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
});
