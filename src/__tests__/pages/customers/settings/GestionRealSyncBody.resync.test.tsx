import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Stable hook return refs (hoisted) ─────────────────────────────────────────
// ConfigSection runs `useEffect([config])`; returning a FRESH object each render
// loops. We keep ONE stable ref per hook and mutate its fields in place.
const h = vi.hoisted(() => {
  const syncConfig = { data: { intervalMs: 300000, estados: ['1', '3'] }, isLoading: false, isError: false, refetch: () => {} };
  const updateSyncConfig = { mutate: () => {}, isPending: false, isSuccess: false, isError: false, error: null, reset: () => {} };
  const featureFlag = { data: { key: 'gestion-real-sync', enabled: false }, isLoading: false, isError: false };
  const setFeatureFlag = { mutate: () => {}, isPending: false, isError: false };
  const syncStatus = { data: null as unknown, isLoading: false, isError: false };
  const resyncAll = { mutate: vi.fn(), isPending: false, isSuccess: false, isError: false, error: null as unknown, reset: vi.fn() };
  const clientStats = { data: undefined as unknown, isLoading: false, isError: false };
  const confirmFn = vi.fn();
  return { syncConfig, updateSyncConfig, featureFlag, setFeatureFlag, syncStatus, resyncAll, clientStats, confirmFn };
});

vi.mock('@/hooks/useGestionRealSyncConfig', () => ({
  useSyncConfig: () => h.syncConfig,
  useUpdateSyncConfig: () => h.updateSyncConfig,
  useResyncAll: () => h.resyncAll,
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: () => h.featureFlag,
  useSetFeatureFlag: () => h.setFeatureFlag,
}));
vi.mock('@/hooks/useGestionRealSync', () => ({
  useGestionRealSyncStatus: () => h.syncStatus,
}));
vi.mock('@/hooks/useCustomers', () => ({
  useClientStats: () => h.clientStats,
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => h.confirmFn,
}));

import { GestionRealSyncBody } from '@/pages/customers/settings/GestionRealSyncBody';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset stable refs to defaults.
  Object.assign(h.resyncAll, { mutate: vi.fn(), isPending: false, isSuccess: false, isError: false, error: null, reset: vi.fn() });
  h.clientStats.data = undefined;
  h.clientStats.isLoading = false;
  h.clientStats.isError = false;
  h.confirmFn.mockReset();
});

// ── Mantenimiento — button presence / enabled ─────────────────────────────────

describe('Mantenimiento — Re-sincronizar todo button', () => {
  it('renders the section with an enabled "Re-sincronizar todo" button', () => {
    render(<GestionRealSyncBody />);
    expect(screen.getByText('Mantenimiento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-sincronizar todo' })).toBeEnabled();
  });

  it('confirming the danger dialog calls resyncAll mutate exactly once', async () => {
    h.confirmFn.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByRole('button', { name: 'Re-sincronizar todo' }));

    await waitFor(() => expect(h.resyncAll.mutate).toHaveBeenCalledTimes(1));
    expect(h.confirmFn).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    const arg = h.confirmFn.mock.calls[0][0];
    expect(arg.message).toMatch(/clientes y contratos/i);
  });

  it('cancelling the dialog does NOT call resyncAll mutate', async () => {
    h.confirmFn.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByRole('button', { name: 'Re-sincronizar todo' }));

    // Give the awaited promise a tick to settle.
    await Promise.resolve();
    expect(h.resyncAll.mutate).not.toHaveBeenCalled();
  });

  it('pending state disables the button and shows progress copy', () => {
    h.resyncAll.isPending = true;
    render(<GestionRealSyncBody />);

    const btn = screen.getByRole('button', { name: 'Re-sincronizando…' });
    expect(btn).toBeDisabled();
    h.resyncAll.isPending = false;
  });

  it('success shows the "Re-sincronización iniciada" banner', () => {
    h.resyncAll.isSuccess = true;
    render(<GestionRealSyncBody />);
    expect(screen.getByText(/re-sincronización iniciada/i)).toBeInTheDocument();
    h.resyncAll.isSuccess = false;
  });

  it('a 403 surfaces a permission message', () => {
    h.resyncAll.isError = true;
    h.resyncAll.error = { response: { status: 403 } };
    render(<GestionRealSyncBody />);
    expect(screen.getByText(/no tenés permiso/i)).toBeInTheDocument();
    h.resyncAll.isError = false;
    h.resyncAll.error = null;
  });

  it('a non-403 error shows a generic retry message', () => {
    h.resyncAll.isError = true;
    h.resyncAll.error = { response: { status: 500 } };
    render(<GestionRealSyncBody />);
    expect(screen.getByText(/no se pudo iniciar la re-sincronización/i)).toBeInTheDocument();
    h.resyncAll.isError = false;
    h.resyncAll.error = null;
  });
});

// ── Distribución por estado — breakdown ───────────────────────────────────────

describe('Distribución por estado — breakdown', () => {
  it('renders the six labelled buckets from stats (es-AR formatting)', () => {
    h.clientStats.data = { total: 1500, active: 1000, late: 200, inactive: 150, blocked: 100, baja: 50 };
    render(<GestionRealSyncBody />);

    expect(screen.getByText('Distribución por estado')).toBeInTheDocument();

    expect(screen.getByTestId('gr-estado-total')).toHaveTextContent('Total');
    expect(screen.getByTestId('gr-estado-total')).toHaveTextContent('1.500');
    expect(screen.getByTestId('gr-estado-active')).toHaveTextContent('Activos');
    expect(screen.getByTestId('gr-estado-active')).toHaveTextContent('1.000');
    expect(screen.getByTestId('gr-estado-late')).toHaveTextContent('Deudor');
    expect(screen.getByTestId('gr-estado-late')).toHaveTextContent('200');
    expect(screen.getByTestId('gr-estado-inactive')).toHaveTextContent('Inactivo');
    expect(screen.getByTestId('gr-estado-inactive')).toHaveTextContent('150');
    expect(screen.getByTestId('gr-estado-blocked')).toHaveTextContent('Incobrable');
    expect(screen.getByTestId('gr-estado-blocked')).toHaveTextContent('100');
    expect(screen.getByTestId('gr-estado-baja')).toHaveTextContent('Bajas');
    expect(screen.getByTestId('gr-estado-baja')).toHaveTextContent('50');
  });

  it('loading with no data renders a placeholder without crashing', () => {
    h.clientStats.isLoading = true;
    h.clientStats.data = undefined;
    render(<GestionRealSyncBody />);
    expect(screen.getByText('Distribución por estado')).toBeInTheDocument();
  });

  it('undefined data defaults every bucket to 0', () => {
    h.clientStats.data = undefined;
    render(<GestionRealSyncBody />);

    expect(screen.getByTestId('gr-estado-total')).toHaveTextContent('0');
    expect(screen.getByTestId('gr-estado-active')).toHaveTextContent('0');
    expect(screen.getByTestId('gr-estado-baja')).toHaveTextContent('0');
  });
});

// ── Regression: existing sections still mount ─────────────────────────────────

describe('Existing sections still render', () => {
  it('Configuración and Estado sections coexist with the new ones', () => {
    h.clientStats.data = { total: 0, active: 0, late: 0, inactive: 0, blocked: 0, baja: 0 };
    render(<GestionRealSyncBody />);
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('Distribución por estado')).toBeInTheDocument();
  });
});
