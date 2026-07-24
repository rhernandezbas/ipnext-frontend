/**
 * NocAlertThresholdsEditor tests (change `noc-alerts-config`, Fase F FE).
 * Molde: NocBroadcastCard (GET puebla el form, diff a mano, confirm antes de
 * guardar, feedback éxito/error, `dirty` gatea el botón).
 *
 * GATE REAL (ver comentario del componente): el BE exige `monitoring.manage`
 * incluso para el GET humano de `/alerts/thresholds` — no hay modo
 * solo-lectura con `monitoring.read`. Por eso el único gate acá es
 * `monitoring.manage`; sin él, se muestra un fallback explicando el permiso
 * faltante, SIN intentar el fetch.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NocAlertThresholdsDto } from '@/types/nocAlertThresholds';

vi.mock('@/hooks/useNocAlertThresholds', () => ({
  useNocAlertThresholds: vi.fn(),
  useUpdateNocAlertThresholds: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useNocAlertThresholds, useUpdateNocAlertThresholds } from '@/hooks/useNocAlertThresholds';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { NocAlertThresholdsEditor } from '@/components/settings/NocAlertThresholdsEditor';

function makeConfig(overrides: Partial<NocAlertThresholdsDto> = {}): NocAlertThresholdsDto {
  return {
    critDbm: -30,
    warnDbm: -27,
    deltaAlert: 2,
    ponMinAbon: 2,
    ponDelta: 1.5,
    ...overrides,
  };
}

function setupHooks({
  permissions = ['monitoring.manage'],
  config,
  isLoading = false,
  isError = false,
  updatePending = false,
  updateError = false,
  updateSuccess = false,
  confirmResult = true,
}: {
  permissions?: string[];
  /** Omit entirely (leave `undefined`) for the loading/error branches — passing
   *  `undefined` explicitly would be indistinguishable from "not provided" via
   *  a destructured default, so the happy-path fallback lives here instead. */
  config?: NocAlertThresholdsDto;
  isLoading?: boolean;
  isError?: boolean;
  updatePending?: boolean;
  updateError?: boolean;
  updateSuccess?: boolean;
  confirmResult?: boolean;
} = {}) {
  const refetchFn = vi.fn();
  const mutateFn = vi.fn();
  const resetFn = vi.fn();
  const confirmFn = vi.fn().mockResolvedValue(confirmResult);
  const resolvedConfig = config !== undefined ? config : isLoading || isError ? undefined : makeConfig();

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((perm) => permissions.includes(perm));
    },
  } as never);
  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useNocAlertThresholds).mockReturnValue({
    data: resolvedConfig,
    isLoading,
    isError,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof useNocAlertThresholds>);

  vi.mocked(useUpdateNocAlertThresholds).mockReturnValue({
    mutate: mutateFn,
    isPending: updatePending,
    isError: updateError,
    isSuccess: updateSuccess,
    error: updateError ? { response: { status: 403 } } : null,
    reset: resetFn,
  } as unknown as ReturnType<typeof useUpdateNocAlertThresholds>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { refetchFn, mutateFn, confirmFn };
}

describe('NocAlertThresholdsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a permission fallback (no fetch attempted) without monitoring.manage', () => {
    setupHooks({ permissions: [] });
    render(<NocAlertThresholdsEditor />);
    expect(screen.getByText(/monitoring\.manage/i)).toBeInTheDocument();
    expect(useNocAlertThresholds).not.toHaveBeenCalled();
  });

  it('renders loading state', () => {
    setupHooks({ isLoading: true });
    render(<NocAlertThresholdsEditor />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const { refetchFn } = setupHooks({ isError: true });
    render(<NocAlertThresholdsEditor />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('populates the 5 fields from the loaded config', () => {
    setupHooks({ config: makeConfig({ critDbm: -31, warnDbm: -28, deltaAlert: 2.5, ponMinAbon: 3, ponDelta: 1.8 }) });
    render(<NocAlertThresholdsEditor />);

    expect(screen.getByLabelText(/rx cr[ií]tico/i)).toHaveValue(-31);
    expect(screen.getByLabelText(/rx warning/i)).toHaveValue(-28);
    expect(screen.getByLabelText(/delta de alerta individual/i)).toHaveValue(2.5);
    expect(screen.getByLabelText(/m[ií]nimo de abonados/i)).toHaveValue(3);
    expect(screen.getByLabelText(/delta medio del pon/i)).toHaveValue(1.8);
  });

  it('save button is disabled while the form is not dirty', () => {
    setupHooks();
    render(<NocAlertThresholdsEditor />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('editing a field enables the save button', () => {
    setupHooks();
    render(<NocAlertThresholdsEditor />);

    fireEvent.change(screen.getByLabelText(/rx warning/i), { target: { value: '-26' } });

    expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled();
  });

  it('rejects ponMinAbon that is not a non-negative integer', async () => {
    setupHooks();
    render(<NocAlertThresholdsEditor />);

    fireEvent.change(screen.getByLabelText(/m[ií]nimo de abonados/i), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/entero mayor o igual a 0/i)).toBeInTheDocument();
  });

  it('rejects critDbm worse (less negative) than warnDbm — inverted thresholds', async () => {
    const { mutateFn } = setupHooks();
    render(<NocAlertThresholdsEditor />);

    fireEvent.change(screen.getByLabelText(/rx cr[ií]tico/i), { target: { value: '-20' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/ninguna alerta escala a cr[ií]tica/i)).toBeInTheDocument();
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('saving asks for confirmation (tone danger) and mutates with the parsed payload', async () => {
    const { mutateFn, confirmFn } = setupHooks();
    render(<NocAlertThresholdsEditor />);

    fireEvent.change(screen.getByLabelText(/rx warning/i), { target: { value: '-26' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(confirmFn).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({
        critDbm: -30,
        warnDbm: -26,
        deltaAlert: 2,
        ponMinAbon: 2,
        ponDelta: 1.5,
      });
    });
  });

  it('does NOT mutate when the save confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ confirmResult: false });
    render(<NocAlertThresholdsEditor />);

    fireEvent.change(screen.getByLabelText(/rx warning/i), { target: { value: '-26' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('shows a mapped error banner on 403 (missing monitoring.manage on save)', () => {
    setupHooks({ updateError: true });
    render(<NocAlertThresholdsEditor />);
    expect(screen.getByText(/falta monitoring\.manage/i)).toBeInTheDocument();
  });

  it('save button is disabled while the mutation is pending', () => {
    setupHooks({ updatePending: true });
    render(<NocAlertThresholdsEditor />);
    fireEvent.change(screen.getByLabelText(/rx warning/i), { target: { value: '-26' } });
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });
});
