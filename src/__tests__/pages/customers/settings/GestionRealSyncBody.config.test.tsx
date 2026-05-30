import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock the hooks the body consumes (axios/api never touched here) ──────────
const mockUseSyncConfig = vi.fn();
const mockUseUpdateSyncConfig = vi.fn();
const mockUseFeatureFlag = vi.fn();
const mockUseSetFeatureFlag = vi.fn();
const mockUseGestionRealSyncStatus = vi.fn();

vi.mock('@/hooks/useGestionRealSyncConfig', () => ({
  useSyncConfig: () => mockUseSyncConfig(),
  useUpdateSyncConfig: () => mockUseUpdateSyncConfig(),
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
  useSetFeatureFlag: () => mockUseSetFeatureFlag(),
}));
vi.mock('@/hooks/useGestionRealSync', () => ({
  useGestionRealSyncStatus: () => mockUseGestionRealSyncStatus(),
}));

import { GestionRealSyncBody } from '@/pages/customers/settings/GestionRealSyncBody';

// Mutation / setFlag handles reused across tests.
let mutateSpy: ReturnType<typeof vi.fn>;
let setFlagMutate: ReturnType<typeof vi.fn>;

function configReturn(over: Partial<{ data: unknown; isLoading: boolean; isError: boolean }> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over };
}

function updateReturn(over: Record<string, unknown> = {}) {
  mutateSpy = vi.fn();
  return {
    mutate: mutateSpy,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    ...over,
  };
}

function flagReturn(enabled: boolean) {
  return { data: { key: 'gestion-real-sync', enabled }, isLoading: false, isError: false };
}

function setFlagReturn(over: Record<string, unknown> = {}) {
  setFlagMutate = vi.fn();
  return { mutate: setFlagMutate, isPending: false, isError: false, ...over };
}

function statusReturn(data: unknown = null) {
  return { data, isLoading: false, isError: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults; individual tests override.
  mockUseSyncConfig.mockReturnValue(configReturn({ data: { intervalMs: 300000, estados: ['1', '3'] } }));
  mockUseUpdateSyncConfig.mockReturnValue(updateReturn());
  mockUseFeatureFlag.mockReturnValue(flagReturn(false));
  mockUseSetFeatureFlag.mockReturnValue(setFlagReturn());
  mockUseGestionRealSyncStatus.mockReturnValue(statusReturn());
});

// ── Config: load / render ────────────────────────────────────────────────────

describe('Configuración — render from API', () => {
  it('shows 5 min selected, Activo+Inactivo checked, others unchecked, Guardar disabled', () => {
    render(<GestionRealSyncBody />);

    const interval = screen.getByLabelText('Intervalo (minutos)') as HTMLSelectElement;
    expect(interval.value).toBe('5');

    expect((screen.getByLabelText('Activo') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Inactivo') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Deudor') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Incobrable') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Baja') as HTMLInputElement).checked).toBe(false);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

// ── Config: interval edits ───────────────────────────────────────────────────

describe('Configuración — interval', () => {
  it('changing 5→15 min enables Guardar and saves intervalMs:900000', async () => {
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.selectOptions(screen.getByLabelText('Intervalo (minutos)'), '15');

    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(mutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: 900000 }),
    );
  });

  it('non-preset intervalMs:200000 renders a (personalizado) option and untouched save preserves it', async () => {
    mockUseSyncConfig.mockReturnValue(configReturn({ data: { intervalMs: 200000, estados: [] } }));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    const interval = screen.getByLabelText('Intervalo (minutos)') as HTMLSelectElement;
    expect(interval.value).toBe('3');
    const customOption = within(interval)
      .getAllByRole('option')
      .find(o => /personalizado/i.test(o.textContent ?? ''));
    expect(customOption).toBeDefined();

    // Toggle an estado to make the form dirty without touching the interval.
    await user.click(screen.getByLabelText('Activo'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: 200000 }),
    );
  });
});

// ── Config: estados ──────────────────────────────────────────────────────────

describe('Configuración — estados', () => {
  it('checking Deudor + unchecking Activo on ["1"] enables Guardar and saves ["2"] (catalog order)', async () => {
    mockUseSyncConfig.mockReturnValue(configReturn({ data: { intervalMs: 300000, estados: ['1'] } }));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByLabelText('Deudor'));
    await user.click(screen.getByLabelText('Activo'));

    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(mutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ estados: ['2'] }),
    );
  });

  it('empty estados is allowed and shows a hint', async () => {
    mockUseSyncConfig.mockReturnValue(configReturn({ data: { intervalMs: 300000, estados: ['1'] } }));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByLabelText('Activo')); // now []
    expect(screen.getByText(/no se sincroniza ningún cliente/i)).toBeInTheDocument();

    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(mutateSpy).toHaveBeenCalledWith(expect.objectContaining({ estados: [] }));
  });

  it('re-checking back to original estados reports clean (set equality)', async () => {
    mockUseSyncConfig.mockReturnValue(configReturn({ data: { intervalMs: 300000, estados: ['1', '3'] } }));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    // Uncheck then re-check Activo → identical set → clean.
    await user.click(screen.getByLabelText('Activo'));
    await user.click(screen.getByLabelText('Activo'));

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

// ── Config: flag toggle ──────────────────────────────────────────────────────

describe('Configuración — feature flag toggle', () => {
  it('flag enabled → toggle checked', () => {
    mockUseFeatureFlag.mockReturnValue(flagReturn(true));
    render(<GestionRealSyncBody />);
    expect((screen.getByLabelText(/activar sincronización/i) as HTMLInputElement).checked).toBe(true);
  });

  it('switching off calls setFeatureFlag with enabled:false', async () => {
    mockUseFeatureFlag.mockReturnValue(flagReturn(true));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByLabelText(/activar sincronización/i));
    expect(setFlagMutate).toHaveBeenCalledWith({ key: 'gestion-real-sync', enabled: false });
  });

  it('switching on calls setFeatureFlag with enabled:true (no enable-guard)', async () => {
    mockUseFeatureFlag.mockReturnValue(flagReturn(false));
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByLabelText(/activar sincronización/i));
    expect(setFlagMutate).toHaveBeenCalledWith({ key: 'gestion-real-sync', enabled: true });
  });

  it('toggle is independent of Guardar (does not call updateSyncConfig)', async () => {
    const user = userEvent.setup();
    render(<GestionRealSyncBody />);

    await user.click(screen.getByLabelText(/activar sincronización/i));
    expect(mutateSpy).not.toHaveBeenCalled();
  });
});

// ── Config: save feedback ────────────────────────────────────────────────────

describe('Configuración — save feedback', () => {
  it('success shows "Configuración guardada" and Guardar returns disabled', () => {
    // Success with the form clean against the (unchanged) baseline.
    mockUseUpdateSyncConfig.mockReturnValue(updateReturn({ isSuccess: true }));
    render(<GestionRealSyncBody />);

    expect(screen.getByText(/configuración guardada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('400 VALIDATION_ERROR shows a Spanish message and no success banner', () => {
    mockUseUpdateSyncConfig.mockReturnValue(
      updateReturn({
        isError: true,
        error: { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } },
      }),
    );
    render(<GestionRealSyncBody />);

    expect(screen.getByText(/datos inválidos/i)).toBeInTheDocument();
    expect(screen.queryByText(/configuración guardada/i)).not.toBeInTheDocument();
  });
});

// ── Estado section ───────────────────────────────────────────────────────────

describe('Estado — sync status', () => {
  it('renders formatted lastRunAt and counters', () => {
    mockUseGestionRealSyncStatus.mockReturnValue(
      statusReturn({
        entity: 'clients',
        cursor: null,
        lastRunAt: '2026-05-29T10:00:00Z',
        lastResult: 'ok',
        itemsSynced: 42,
        hasRun: true,
        clientCount: 1000,
        contractCount: 500,
      }),
    );
    render(<GestionRealSyncBody />);

    expect(screen.getByTestId('gr-sync-counter-itemsSynced')).toHaveTextContent('42');
    expect(screen.getByTestId('gr-sync-counter-clientCount')).toHaveTextContent('1.000');
    expect(screen.getByTestId('gr-sync-counter-contractCount')).toHaveTextContent('500');
    expect(screen.queryByText('Nunca')).not.toBeInTheDocument();
  });

  it('null lastRunAt shows "Nunca"', () => {
    mockUseGestionRealSyncStatus.mockReturnValue(
      statusReturn({
        entity: 'clients',
        cursor: null,
        lastRunAt: null,
        lastResult: null,
        itemsSynced: 0,
        hasRun: false,
      }),
    );
    render(<GestionRealSyncBody />);
    expect(screen.getByText('Nunca')).toBeInTheDocument();
  });
});
