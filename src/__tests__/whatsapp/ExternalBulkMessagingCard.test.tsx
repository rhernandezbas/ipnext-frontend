/**
 * ExternalBulkMessagingCard tests — external-bulk-messaging FE (D13, Batch B5).
 * Card "Envío masivo externo (API)" en Ajustes → WhatsApp: molde EXACTO
 * `ChatwootSendPathCard.tsx` para el Bloque 1 (kill-switch del flag
 * `messaging-external-bulk-enabled`, gate `admin.flags`) + un Bloque 2 nuevo
 * (topes `maxPerRequest`/`maxPerDay`, gate `messaging.manage`, molde
 * `NocBroadcastCard.tsx` para el form).
 *
 * Contrato BE:
 *   Flag: GET/PATCH /api/feature-flags/messaging-external-bulk-enabled (YA EXISTE, D7.c)
 *   Config: GET/PUT /api/messaging/config/external-bulk → {maxPerRequest,maxPerDay,updatedAt}
 *           (envelope FLAT, gate messaging:read / messaging:manage, 400 si inválido)
 *
 * Covers:
 *  1. Loading (skeleton) mientras el flag O la config están cargando
 *  2. Error de fetch (flag o config) → "Estado desconocido", toggle deshabilitado/oculto,
 *     banner role="alert" + reintentar
 *  3. Descripción de una línea explicando el propósito de la card
 *  4. Badge ON/OFF
 *  5. Toggle ON → confirm danger mencionando "IA"/"API externa"/envíos masivos
 *  6. Toggle ON cancelado → NO mutate
 *  7. Toggle OFF → confirm danger mencionando 403
 *  8. Toggle OFF cancelado → NO mutate
 *  9. Gate admin.flags oculta el toggle
 * 10. Toast de éxito usa la intención del PATCH (setFlag.variables), no el estado stale
 * 11. Topes: sin messaging.manage → inputs read-only, NO oculto, sin botón Guardar
 * 12. Topes: validación cliente (entero >= 1, maxPerRequest <= maxPerDay) deshabilita
 *     Guardar ANTES de llamar al hook, con error inline por campo
 * 13. Topes: Guardar válido → confirm con el impacto (N por request, M por día) → mutate
 * 14. Topes: confirm cancelado → NO mutate
 * 15. Topes: error 400 del BE (mockeado) se muestra igual si el cliente no lo atrapó
 * 16. Accesibilidad: labels asociados, aria-live en banners, foco en Guardar tras error
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSyncExternalStore } from 'react';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));
vi.mock('@/hooks/useExternalBulkMessagingConfig', () => ({
  useExternalBulkMessagingConfig: vi.fn(),
  useSetExternalBulkMessagingConfig: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useExternalBulkMessagingConfig,
  useSetExternalBulkMessagingConfig,
} from '@/hooks/useExternalBulkMessagingConfig';
import { ExternalBulkMessagingCard } from '@/components/settings/ExternalBulkMessagingCard';

const FLAG_KEY = 'messaging-external-bulk-enabled';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagPending = false,
  setFlagError = false,
  setFlagSuccess = false,
  setFlagVariables = undefined,
  config = { maxPerRequest: 500, maxPerDay: 2000, updatedAt: '2026-09-01T12:00:00.000Z' },
  configLoading = false,
  configError = false,
  refetchConfigFn = vi.fn(),
  setConfigPending = false,
  setConfigError = false,
  setConfigErrorObj = undefined as unknown,
  setConfigSuccess = false,
  permissions = ['admin.flags', 'messaging.manage'],
  confirmResult = true,
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
  setFlagPending?: boolean;
  setFlagError?: boolean;
  setFlagSuccess?: boolean;
  setFlagVariables?: { key: string; enabled: boolean } | undefined;
  config?: { maxPerRequest: number; maxPerDay: number; updatedAt: string } | undefined;
  configLoading?: boolean;
  configError?: boolean;
  refetchConfigFn?: ReturnType<typeof vi.fn>;
  setConfigPending?: boolean;
  setConfigError?: boolean;
  setConfigErrorObj?: unknown;
  setConfigSuccess?: boolean;
  permissions?: string[];
  confirmResult?: boolean;
} = {}) {
  const mutateFlagFn = vi.fn();
  const mutateConfigFn = vi.fn();
  const confirmFn = vi.fn().mockResolvedValue(confirmResult);
  const refetchFlagFn = vi.fn();

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], mode: 'any' | 'all' = 'any') => {
      const perms = Array.isArray(p) ? p : [p];
      return mode === 'all' ? perms.every((x) => permissions.includes(x)) : perms.some((x) => permissions.includes(x));
    },
  } as never);
  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data: flagLoading || flagError ? undefined : { key: FLAG_KEY, enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFlagFn,
  } as unknown as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFlagFn,
    isPending: setFlagPending,
    isError: setFlagError,
    isSuccess: setFlagSuccess,
    variables: setFlagVariables,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useExternalBulkMessagingConfig).mockReturnValue({
    data: configLoading || configError ? undefined : config,
    isLoading: configLoading,
    isError: configError,
    refetch: refetchConfigFn,
  } as unknown as ReturnType<typeof useExternalBulkMessagingConfig>);

  const resetConfigFn = vi.fn();
  vi.mocked(useSetExternalBulkMessagingConfig).mockReturnValue({
    mutate: mutateConfigFn,
    isPending: setConfigPending,
    isError: setConfigError,
    isSuccess: setConfigSuccess,
    error: setConfigErrorObj,
    reset: resetConfigFn,
  } as unknown as ReturnType<typeof useSetExternalBulkMessagingConfig>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFlagFn, mutateConfigFn, confirmFn, refetchFlagFn, refetchConfigFn, resetConfigFn };
}

vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));

type ReactiveConfig = { maxPerRequest: number; maxPerDay: number; updatedAt: string };

/**
 * Fix wave 2, item 3 — mock REACTIVO de `useExternalBulkMessagingConfig` +
 * `useSetExternalBulkMessagingConfig` (molde `createReactiveTaskStageConfigMock`
 * de `CampaignComposer.test.tsx`, fix wave F1). A diferencia de un objeto
 * estático `{isSuccess: true}` armado ANTES del render (que nunca transiciona
 * — el test pasa aunque se borre toda la lógica de `disabled`/banner, porque
 * nunca ejercita la transición idle → pending → success/error), acá
 * `mutate()` togglea el estado de VERDAD vía `useSyncExternalStore`, con el
 * mismo timing que describe el fix: el PUT resuelve a los ~40ms y, recién
 * ahí, simula lo que hace `onSuccess` real (`setQueryData` — la config
 * sincroniza con el payload guardado); el refetch de `onSettled` llega
 * ~120ms más tarde y no cambia nada (ya está consistente).
 */
function createReactiveConfigMock(initialConfig: ReactiveConfig, opts: { shouldFail?: boolean } = {}) {
  const mutateSpy = vi.fn();
  const resetSpy = vi.fn();
  let snapshot = {
    config: initialConfig,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: undefined as unknown,
    variables: undefined as { maxPerRequest: number; maxPerDay: number } | undefined,
  };
  const listeners = new Set<() => void>();
  function notify() {
    listeners.forEach((l) => l());
  }
  function setSnapshot(patch: Partial<typeof snapshot>) {
    snapshot = { ...snapshot, ...patch };
    notify();
  }
  function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }
  function useConfigHook() {
    const s = useSyncExternalStore(subscribe, () => snapshot);
    return {
      data: s.config,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useExternalBulkMessagingConfig>;
  }
  function useSetConfigHook() {
    const s = useSyncExternalStore(subscribe, () => snapshot);
    return {
      mutate: (payload: { maxPerRequest: number; maxPerDay: number }) => {
        mutateSpy(payload);
        setSnapshot({ isPending: true, isSuccess: false, isError: false, variables: payload });
        setTimeout(() => {
          if (opts.shouldFail) {
            setSnapshot({ isPending: false, isError: true, error: Object.assign(new Error('bad'), { response: { status: 400 } }) });
            return;
          }
          // Simula `onSuccess`: `setQueryData` sincrónico con la respuesta del PUT.
          setSnapshot({
            isPending: false,
            isSuccess: true,
            config: { ...payload, updatedAt: '2026-09-02T00:00:00.000Z' },
          });
          // Simula el refetch de `onSettled`, ~120ms más tarde — ya consistente.
          setTimeout(() => notify(), 80);
        }, 40);
      },
      isPending: s.isPending,
      isError: s.isError,
      isSuccess: s.isSuccess,
      error: s.error,
      variables: s.variables,
      reset: () => {
        resetSpy();
        setSnapshot({ isSuccess: false, isError: false, error: undefined });
      },
    } as unknown as ReturnType<typeof useSetExternalBulkMessagingConfig>;
  }
  return { useConfigHook, useSetConfigHook, mutateSpy, resetSpy, setSnapshot };
}

describe('ExternalBulkMessagingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it('renders loading state while the flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders loading state while the config is loading', () => {
    setupHooks({ configLoading: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  // ── Description ───────────────────────────────────────────────────────────

  it('renders a one-line explanation of what the card is for', () => {
    setupHooks();
    render(<ExternalBulkMessagingCard />);
    expect(
      screen.getByText(/una ia o integraci[oó]n externa/i),
    ).toBeInTheDocument();
  });

  // ── Badge ──────────────────────────────────────────────────────────────────

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
  });

  // ── Toggle ON ──────────────────────────────────────────────────────────────

  it('turning ON asks confirmation (danger) mentioning external AI/API bulk sends', async () => {
    const { mutateFlagFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<ExternalBulkMessagingCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /activar/i }));

    await waitFor(() => {
      expect(mutateFlagFn).toHaveBeenCalledWith({ key: FLAG_KEY, enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/ia|api externa/i),
      }),
    );
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/env[ií]os masivos/i),
      }),
    );
  });

  it('turning ON does NOT mutate when confirmation is cancelled', async () => {
    const { mutateFlagFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<ExternalBulkMessagingCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /activar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFlagFn).not.toHaveBeenCalled();
  });

  // ── Toggle OFF ─────────────────────────────────────────────────────────────

  it('turning OFF asks confirmation (danger) mentioning 403 for external callers', async () => {
    const { mutateFlagFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<ExternalBulkMessagingCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /desactivar/i }));

    await waitFor(() => {
      expect(mutateFlagFn).toHaveBeenCalledWith({ key: FLAG_KEY, enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/403/),
      }),
    );
  });

  it('turning OFF does NOT mutate when confirmation is cancelled', async () => {
    const { mutateFlagFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<ExternalBulkMessagingCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /desactivar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFlagFn).not.toHaveBeenCalled();
  });

  it('toggle is disabled while setFlag mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('toggle is NOT rendered without admin.flags', () => {
    setupHooks({ permissions: ['messaging.manage'] });
    render(<ExternalBulkMessagingCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Success toast uses PATCH intent ───────────────────────────────────────

  it('success toast uses the PATCH intent (setFlag.variables), not the stale live flag state', () => {
    setupHooks({
      flagEnabled: false,
      setFlagSuccess: true,
      setFlagVariables: { key: FLAG_KEY, enabled: true },
    });
    render(<ExternalBulkMessagingCard />);
    const status = screen.getByRole('status', { name: '' }) ?? screen.getAllByRole('status')[0];
    expect(status).toHaveTextContent(/activado/i);
  });

  // ── Fetch error ────────────────────────────────────────────────────────────

  it('flag-fetch error shows "Estado desconocido", never a confident state, and offers retry', () => {
    const { refetchFlagFn } = setupHooks({ flagError: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFlagFn).toHaveBeenCalled();
  });

  it('config-fetch error also shows "Estado desconocido" with retry', () => {
    const refetchConfigFn = vi.fn();
    setupHooks({ configError: true, refetchConfigFn });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchConfigFn).toHaveBeenCalled();
  });

  // ── Topes: gate messaging.manage ──────────────────────────────────────────

  it('caps inputs are read-only (not hidden) without messaging.manage', () => {
    setupHooks({ permissions: ['admin.flags'] });
    render(<ExternalBulkMessagingCard />);
    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    const maxPerDay = screen.getByLabelText(/tope diario/i);
    expect(maxPerRequest).toBeInTheDocument();
    expect(maxPerRequest).toBeDisabled();
    expect(maxPerDay).toBeDisabled();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('caps inputs are populated from the loaded config', () => {
    setupHooks({ config: { maxPerRequest: 123, maxPerDay: 456, updatedAt: '2026-09-01T12:00:00.000Z' } });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByLabelText(/tope por request/i)).toHaveValue(123);
    expect(screen.getByLabelText(/tope diario/i)).toHaveValue(456);
  });

  it('caps inputs show 500/2000 placeholders', () => {
    setupHooks();
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByLabelText(/tope por request/i)).toHaveAttribute('placeholder', '500');
    expect(screen.getByLabelText(/tope diario/i)).toHaveAttribute('placeholder', '2000');
  });

  // ── Topes: validación cliente ─────────────────────────────────────────────

  it('client validation: maxPerRequest > maxPerDay disables Guardar with an inline error, without calling the hook', async () => {
    const user = userEvent.setup();
    const { mutateConfigFn, confirmFn } = setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '3000');

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/no puede ser mayor/i)).toBeInTheDocument();

    fireEvent.click(saveBtn);
    expect(confirmFn).not.toHaveBeenCalled();
    expect(mutateConfigFn).not.toHaveBeenCalled();
  });

  it('client validation: non-integer or < 1 disables Guardar with an inline error', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerDay = screen.getByLabelText(/tope diario/i);
    await user.clear(maxPerDay);
    await user.type(maxPerDay, '0');

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(screen.getByText(/entero.*mayor o igual a 1/i)).toBeInTheDocument();
  });

  // ── Topes: guardar válido ─────────────────────────────────────────────────

  it('valid save asks confirmation with the impact copy (N per request, M per day) then mutates', async () => {
    const user = userEvent.setup();
    const { mutateConfigFn, confirmFn } = setupHooks({
      config: { maxPerRequest: 500, maxPerDay: 2000, updatedAt: '2026-09-01T12:00:00.000Z' },
    });
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '300');

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/300.*2000|hasta 300/i),
      }),
    );
    await waitFor(() => {
      expect(mutateConfigFn).toHaveBeenCalledWith({ maxPerRequest: 300, maxPerDay: 2000 });
    });
  });

  it('save does NOT mutate when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const { mutateConfigFn, confirmFn } = setupHooks({ confirmResult: false });
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '300');

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mutateConfigFn).not.toHaveBeenCalled();
  });

  it('Guardar is disabled while the caps mutation is pending', () => {
    setupHooks({ setConfigPending: true });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });

  // ── Topes: 400 del BE ──────────────────────────────────────────────────────

  it('shows an actionable message for a BE 400 even when the client did not catch it', () => {
    setupHooks({
      setConfigError: true,
      setConfigErrorObj: Object.assign(new Error('bad'), {
        response: { status: 400, data: { code: 'VALIDATION_ERROR' } },
      }),
    });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no v[aá]lidos|entero|no puede ser mayor/i)).toBeInTheDocument();
  });

  // ── Accesibilidad ──────────────────────────────────────────────────────────

  it('caps inputs have associated labels', () => {
    setupHooks();
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByLabelText(/tope por request/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/tope diario/i)).toHaveAttribute('id');
  });

  it('error banners use role="alert"', () => {
    setupHooks({
      setConfigError: true,
      setConfigErrorObj: Object.assign(new Error('bad'), { response: { status: 400 } }),
    });
    render(<ExternalBulkMessagingCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('moves focus to the Guardar button after a save error', async () => {
    setupHooks({
      setConfigError: true,
      setConfigErrorObj: Object.assign(new Error('bad'), { response: { status: 400 } }),
    });
    render(<ExternalBulkMessagingCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guardar/i })).toHaveFocus();
    });
  });

  // ── Finding 1: focus steal + typed values lost after a failed save ────────

  it('after a failed save, focus and the typed value survive a config refetch that returns unchanged server values', async () => {
    const user = userEvent.setup();
    const refetchConfigFn = vi.fn();
    setupHooks({
      setConfigError: true,
      setConfigErrorObj: Object.assign(new Error('bad'), { response: { status: 400 } }),
      refetchConfigFn,
    });
    const { rerender } = render(<ExternalBulkMessagingCard />);

    // The error-transition focus move happens first (existing behaviour).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guardar/i })).toHaveFocus();
    });

    const maxPerDay = screen.getByLabelText(/tope diario/i);
    await user.click(maxPerDay);
    await user.clear(maxPerDay);
    await user.type(maxPerDay, '999');

    expect(maxPerDay).toHaveFocus();
    expect(maxPerDay).toHaveValue(999);

    // Simulate onSettled's refetch resolving with a NEW object (react-query
    // gives a fresh reference even when values are unchanged) — the baseline
    // effect must NOT overwrite a dirty form, and focus must not jump back
    // to the Save button while the user is actively editing.
    vi.mocked(useExternalBulkMessagingConfig).mockReturnValue({
      data: { maxPerRequest: 500, maxPerDay: 2000, updatedAt: '2026-09-01T12:00:01.000Z' },
      isLoading: false,
      isError: false,
      refetch: refetchConfigFn,
    } as unknown as ReturnType<typeof useExternalBulkMessagingConfig>);

    rerender(<ExternalBulkMessagingCard />);

    expect(maxPerDay).toHaveFocus();
    expect(maxPerDay).toHaveValue(999);
  });

  it('syncs the form to new config values on refetch when the form is NOT dirty', () => {
    setupHooks({ config: { maxPerRequest: 500, maxPerDay: 2000, updatedAt: '2026-09-01T12:00:00.000Z' } });
    const { rerender } = render(<ExternalBulkMessagingCard />);
    expect(screen.getByLabelText(/tope por request/i)).toHaveValue(500);

    vi.mocked(useExternalBulkMessagingConfig).mockReturnValue({
      data: { maxPerRequest: 700, maxPerDay: 3000, updatedAt: '2026-09-01T13:00:00.000Z' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useExternalBulkMessagingConfig>);
    rerender(<ExternalBulkMessagingCard />);

    expect(screen.getByLabelText(/tope por request/i)).toHaveValue(700);
    expect(screen.getByLabelText(/tope diario/i)).toHaveValue(3000);
  });

  // ── Finding 2: inline errors associated to inputs via aria-describedby ────

  it('associates a field-level inline error to its input via aria-describedby, plus aria-invalid', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerDay = screen.getByLabelText(/tope diario/i);
    await user.clear(maxPerDay);
    await user.type(maxPerDay, '0');

    const errorText = screen.getByText(/entero.*mayor o igual a 1/i);
    expect(errorText).toHaveAttribute('id');
    const errorId = errorText.getAttribute('id') as string;

    expect(maxPerDay.getAttribute('aria-describedby')).toContain(errorId);
    expect(maxPerDay).toHaveAttribute('aria-invalid', 'true');
  });

  it('associates the cross-field error to BOTH inputs via aria-describedby', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '3000');

    const crossError = screen.getByText(/no puede ser mayor/i);
    expect(crossError).toHaveAttribute('id');
    const crossId = crossError.getAttribute('id') as string;

    const maxPerDay = screen.getByLabelText(/tope diario/i);
    expect(maxPerRequest.getAttribute('aria-describedby')).toContain(crossId);
    expect(maxPerDay.getAttribute('aria-describedby')).toContain(crossId);
  });

  // ── Finding 3: per-keystroke validation is role="status", not role="alert" ─

  it('field-level validation errors use role="status" (polite), leaving role="alert" for the save-failure banner only', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerDay = screen.getByLabelText(/tope diario/i);
    await user.clear(maxPerDay);
    await user.type(maxPerDay, '0');

    const errorText = screen.getByText(/entero.*mayor o igual a 1/i);
    expect(errorText).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the cross-field validation error also uses role="status"', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '3000');

    const crossError = screen.getByText(/no puede ser mayor/i);
    expect(crossError).toHaveAttribute('role', 'status');
  });

  // ── Finding 4: static read-only notice is not a live region ───────────────

  it('the read-only notice has no ARIA role (it is not a live update)', () => {
    setupHooks({ permissions: ['admin.flags'] });
    render(<ExternalBulkMessagingCard />);
    const note = screen.getByText(/solo lectura/i);
    expect(note).not.toHaveAttribute('role');
  });

  // ── Finding 9 (fix wave 2, item 3): Save button retry / clean / unchanged
  // behaviour, ejercitado con transiciones REALES de estado (no mocks
  // estáticos armados ya-en-el-estado-final) ─────────────────────────────

  it('after a failed save, Guardar stays enabled and clicking it retries the PUT', async () => {
    const user = userEvent.setup();
    setupHooks();
    const reactive = createReactiveConfigMock(
      { maxPerRequest: 500, maxPerDay: 2000, updatedAt: '2026-09-01T12:00:00.000Z' },
      { shouldFail: true },
    );
    vi.mocked(useExternalBulkMessagingConfig).mockImplementation(reactive.useConfigHook);
    vi.mocked(useSetExternalBulkMessagingConfig).mockImplementation(reactive.useSetConfigHook);

    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).toBeDisabled(); // sin cambios todavía

    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '600');
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);
    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalledWith({ maxPerRequest: 600, maxPerDay: 2000 }));
    expect(saveBtn).toBeDisabled(); // pending

    // El PUT resuelve (falla, 400) a los ~40ms del mock.
    await waitFor(() => expect(saveBtn).not.toBeDisabled(), { timeout: 1000 });
    expect(screen.getByText(/los topes ingresados no son v[aá]lidos/i)).toBeInTheDocument();

    // Reintento: click de nuevo dispara un segundo mutate con el mismo payload.
    fireEvent.click(saveBtn);
    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalledTimes(2));
    expect(reactive.mutateSpy).toHaveBeenLastCalledWith({ maxPerRequest: 600, maxPerDay: 2000 });
  });

  it('after a successful save, Guardar is disabled again and the success banner shows — and re-editing re-enables it and clears the banner', async () => {
    const user = userEvent.setup();
    setupHooks();
    const reactive = createReactiveConfigMock({
      maxPerRequest: 500,
      maxPerDay: 2000,
      updatedAt: '2026-09-01T12:00:00.000Z',
    });
    vi.mocked(useExternalBulkMessagingConfig).mockImplementation(reactive.useConfigHook);
    vi.mocked(useSetExternalBulkMessagingConfig).mockImplementation(reactive.useSetConfigHook);

    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    const saveBtn = screen.getByRole('button', { name: /guardar/i });

    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '600');
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);
    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalledWith({ maxPerRequest: 600, maxPerDay: 2000 }));

    // Inmediatamente al resolver el PUT (~40ms): banner visible y Guardar
    // deshabilitado — sin esperar ningún refetch adicional (item 1).
    await waitFor(() => expect(screen.getByText(/topes guardados/i)).toBeInTheDocument(), { timeout: 1000 });
    expect(saveBtn).toBeDisabled();

    // El "refetch" simulado (~120ms) no cambia nada — sigue consistente.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/topes guardados/i)).toBeInTheDocument();

    // Editar de nuevo: `reset()` limpia `isSuccess` → banner desaparece y,
    // al quedar el form "sucio" otra vez, Guardar se re-habilita.
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '700');
    expect(reactive.resetSpy).toHaveBeenCalled();
    expect(screen.queryByText(/topes guardados/i)).not.toBeInTheDocument();
    expect(saveBtn).not.toBeDisabled();
  });

  it('Guardar stays disabled while the form matches the loaded config, and stays disabled right on success even before the config query visibly catches up (relies on isSuccess, not only on dirty)', async () => {
    setupHooks();
    const reactive = createReactiveConfigMock({
      maxPerRequest: 500,
      maxPerDay: 2000,
      updatedAt: '2026-09-01T12:00:00.000Z',
    });
    vi.mocked(useExternalBulkMessagingConfig).mockImplementation(reactive.useConfigHook);
    vi.mocked(useSetExternalBulkMessagingConfig).mockImplementation(reactive.useSetConfigHook);

    render(<ExternalBulkMessagingCard />);
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).toBeDisabled(); // nada cambió

    // Race edge case que motiva `|| setConfig.isSuccess` en el `disabled`:
    // `isSuccess` pasa a `true` pero, a propósito, la config del mock queda
    // STALE (no se actualiza) — si el `disabled` dependiera solo de `dirty`,
    // acá `dirty` seguiría en `false` (nada cambió), así que este escenario
    // en particular no lo distingue... el que sí lo distingue es forzar
    // `isSuccess` con la config todavía vieja Y el form editado: sin el
    // `|| setConfig.isSuccess`, `dirty` (form editado, config vieja) daría
    // `true` y el botón quedaría habilitado pese a que la mutation ya se
    // resolvió con éxito.
    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    fireEvent.change(maxPerRequest, { target: { value: '600' } });
    expect(saveBtn).not.toBeDisabled();

    reactive.setSnapshot({ isSuccess: true }); // config NO se toca — a propósito
    await waitFor(() => expect(saveBtn).toBeDisabled());
  });

  // ── Finding 10: strict integer parsing rejects "1e3" ──────────────────────

  it('rejects exponential notation like "1e3" as invalid (strict integer string, not Number())', () => {
    setupHooks();
    render(<ExternalBulkMessagingCard />);
    const maxPerDay = screen.getByLabelText(/tope diario/i);
    fireEvent.change(maxPerDay, { target: { value: '1e3' } });
    expect(screen.getByText(/ingres[aá] un entero/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  // ── Finding 12: typing after an error clears the banner via reset() ───────

  it('typing after a save error calls reset() (clears the stale error banner)', async () => {
    const user = userEvent.setup();
    const { resetConfigFn } = setupHooks({
      setConfigError: true,
      setConfigErrorObj: Object.assign(new Error('bad'), { response: { status: 400 } }),
    });
    render(<ExternalBulkMessagingCard />);

    const maxPerRequest = screen.getByLabelText(/tope por request/i);
    await user.clear(maxPerRequest);
    await user.type(maxPerRequest, '1');

    expect(resetConfigFn).toHaveBeenCalled();
  });
});
