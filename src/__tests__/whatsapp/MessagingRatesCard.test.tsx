/**
 * MessagingRatesCard tests — twilio-credit-guard FE (D8) + fix wave.
 * Card "Saldo Twilio y tarifas por mensaje" en Ajustes → WhatsApp: molde
 * `ExternalBulkMessagingCard.tsx` (2 fetch al mismo padre, userEditedRef,
 * confirm en el guardado, banners role="alert"/"status").
 *
 * Contrato BE:
 *   GET  /api/messaging/config/rates          → {currency,utilityRate,marketingRate,authenticationRate,providerFee,updatedAt}
 *   PUT  /api/messaging/config/rates          → body {currency,utilityRate,marketingRate,authenticationRate,providerFee} (strings)
 *   GET  /api/messaging/config/rates/balance  → {available,currency,fetchedAt,cached} | 503 CREDIT_UNAVAILABLE
 *
 * Covers:
 *  1. Loading (skeleton) mientras las tarifas están cargando
 *  2. Error de fetch de tarifas → banner role="alert" + reintentar, form NO se renderiza
 *  3. Form poblado desde la config cargada (5 inputs)
 *  4. Validación: tarifa inválida / moneda inválida → error inline + Guardar deshabilitado
 *  5. Sin messaging.manage → inputs read-only, sin botón Guardar
 *  6. Guardar habilitado solo si dirty y sin error
 *  7. Confirm con el copy de impacto → mutate con el payload exacto (strings)
 *  8. Confirm cancelado → NO mutate
 *  9. Banner de éxito / error tras guardar
 * 10. Helper "≈ USD X por mensaje CATEGORÍA" por cada categoría
 * 11. Balance: loading / error+retry / success / cached badge
 * 12. Balance 503 NO rompe la edición de tarifas
 * 13. Estimador: cantidad + Select propio (no <select> nativo) → costo + alcanza/no alcanza
 * 14. A11y: labels, aria-describedby, role=status vs alert, heading h3
 *
 * Fix wave (2026-09-03):
 *  F1.  Helper (form sin guardar) vs estimador (tarifas guardadas) — cada uno
 *       honesto sobre SU fuente + nota cruzada cuando hay dirty.
 *  F2.  Heading de la card distinto del h2 de la página (dedup).
 *  F3.  "Tarifas actualizadas el DD/MM/YYYY HH:mm" (es-AR, Bs.As.).
 *  F4.  sufficient===null dice explícitamente que el envío se bloquea.
 *  F5.  Cantidad del estimador validada (entero 1..1.000.000) con feedback.
 *  F6.  Live region debounced (400ms), separado del párrafo visible.
 *  F7.  Helper muestra "—" si la tarifa/fee no pasan la regex de validación.
 *  F8.  Relativo del saldo tickeado (segundos bajo 60s, "recién" a futuro).
 *  F9.  balance.available pasado por formatMoney (4 dp).
 * F10-12. Tests menos tautológicos (verdicto exacto, qty/categoría no-default, copy 400 específico).
 * F13. Escenarios faltantes: retry tras fallo, read-only usa estimador, moneda
 *      distinta balance/tarifas, updatedAt visible.
 */
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSyncExternalStore } from 'react';

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));
vi.mock('@/hooks/useMessagingRatesConfig', () => ({
  useMessagingRatesConfig: vi.fn(),
  useSetMessagingRatesConfig: vi.fn(),
  useMessagingCreditBalance: vi.fn(),
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));

import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useMessagingRatesConfig,
  useSetMessagingRatesConfig,
  useMessagingCreditBalance,
} from '@/hooks/useMessagingRatesConfig';
import { MessagingRatesCard } from '@/components/settings/MessagingRatesCard';

const RATES = {
  currency: 'USD',
  utilityRate: '0.0120',
  marketingRate: '0.0618',
  authenticationRate: '0.0220',
  providerFee: '0.0050',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

const BALANCE = {
  available: '17.8940',
  currency: 'USD',
  fetchedAt: '2026-09-01T12:00:00.000Z',
  cached: false,
};

function setupHooks({
  rates = RATES,
  ratesLoading = false,
  ratesError = false,
  refetchRatesFn = vi.fn(),
  setRatesPending = false,
  setRatesError = false,
  setRatesErrorObj = undefined as unknown,
  setRatesSuccess = false,
  balance = BALANCE as typeof BALANCE | undefined,
  balanceLoading = false,
  balanceError = false,
  refetchBalanceFn = vi.fn(),
  permissions = ['messaging.read', 'messaging.manage'],
  confirmResult = true,
} = {}) {
  const mutateRatesFn = vi.fn();
  const confirmFn = vi.fn().mockResolvedValue(confirmResult);
  const resetRatesFn = vi.fn();

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

  vi.mocked(useMessagingRatesConfig).mockReturnValue({
    data: ratesLoading || ratesError ? undefined : rates,
    isLoading: ratesLoading,
    isError: ratesError,
    refetch: refetchRatesFn,
  } as unknown as ReturnType<typeof useMessagingRatesConfig>);

  vi.mocked(useSetMessagingRatesConfig).mockReturnValue({
    mutate: mutateRatesFn,
    isPending: setRatesPending,
    isError: setRatesError,
    isSuccess: setRatesSuccess,
    error: setRatesErrorObj,
    reset: resetRatesFn,
  } as unknown as ReturnType<typeof useSetMessagingRatesConfig>);

  vi.mocked(useMessagingCreditBalance).mockReturnValue({
    data: balanceLoading || balanceError ? undefined : balance,
    isLoading: balanceLoading,
    isError: balanceError,
    isFetching: false,
    refetch: refetchBalanceFn,
  } as unknown as ReturnType<typeof useMessagingCreditBalance>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateRatesFn, confirmFn, refetchRatesFn, refetchBalanceFn, resetRatesFn };
}

type ReactiveRates = typeof RATES;

/** Molde `createReactiveConfigMock` de `ExternalBulkMessagingCard.test.tsx`. */
function createReactiveRatesMock(initial: ReactiveRates, opts: { shouldFail?: boolean } = {}) {
  const mutateSpy = vi.fn();
  const resetSpy = vi.fn();
  let snapshot = {
    rates: initial,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: undefined as unknown,
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
  function useRatesHook() {
    const s = useSyncExternalStore(subscribe, () => snapshot);
    return { data: s.rates, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<
      typeof useMessagingRatesConfig
    >;
  }
  function useSetRatesHook() {
    const s = useSyncExternalStore(subscribe, () => snapshot);
    return {
      mutate: (payload: Omit<ReactiveRates, 'updatedAt'>) => {
        mutateSpy(payload);
        setSnapshot({ isPending: true, isSuccess: false, isError: false });
        setTimeout(() => {
          if (opts.shouldFail) {
            setSnapshot({
              isPending: false,
              isError: true,
              error: Object.assign(new Error('bad'), { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } }),
            });
            return;
          }
          setSnapshot({ isPending: false, isSuccess: true, rates: { ...payload, updatedAt: '2026-09-02T00:00:00.000Z' } });
        }, 40);
      },
      isPending: s.isPending,
      isError: s.isError,
      isSuccess: s.isSuccess,
      error: s.error,
      reset: () => {
        resetSpy();
        setSnapshot({ isSuccess: false, isError: false, error: undefined });
      },
    } as unknown as ReturnType<typeof useSetMessagingRatesConfig>;
  }
  return { useRatesHook, useSetRatesHook, mutateSpy, resetSpy, setSnapshot };
}

describe('MessagingRatesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading / error de tarifas ────────────────────────────────────────────

  it('renders a loading state while rates are loading', () => {
    setupHooks({ ratesLoading: true });
    render(<MessagingRatesCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/moneda/i)).not.toBeInTheDocument();
  });

  it('rates-fetch error shows a retry banner and does not render the form', () => {
    const { refetchRatesFn } = setupHooks({ ratesError: true });
    render(<MessagingRatesCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText(/moneda/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchRatesFn).toHaveBeenCalled();
  });

  // ── Heading (finding 2) ──────────────────────────────────────────────────

  it('renders its own heading as an h3 with distinct text — NOT the page section h2 text', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByRole('heading', { level: 3, name: /saldo twilio y tarifas por mensaje/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: /^cr[eé]dito y tarifas de whatsapp$/i }),
    ).not.toBeInTheDocument();
  });

  // ── Form poblado ───────────────────────────────────────────────────────────

  it('populates the 5 fields from the loaded config', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByLabelText(/moneda/i)).toHaveValue('USD');
    expect(screen.getByLabelText(/utility/i)).toHaveValue('0.0120');
    expect(screen.getByLabelText(/marketing/i)).toHaveValue('0.0618');
    expect(screen.getByLabelText(/authentication/i)).toHaveValue('0.0220');
    expect(screen.getByLabelText(/fee/i)).toHaveValue('0.0050');
  });

  // ── Validación ─────────────────────────────────────────────────────────────

  it('an invalid rate (more than 4 decimals) shows an inline error and disables Guardar', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '0.06185');

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(screen.getByText(/decimal/i)).toBeInTheDocument();
  });

  it('a negative rate is rejected (the DECIMAL_4_RE has no sign)', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '-0.01');

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('an invalid currency (lowercase or not 3 letters) shows an inline error', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const currency = screen.getByLabelText(/moneda/i);
    await user.clear(currency);
    await user.type(currency, 'US');

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(screen.getByText(/3 letras/i)).toBeInTheDocument();
  });

  it('uppercases the currency as the user types', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const currency = screen.getByLabelText(/moneda/i);
    await user.clear(currency);
    await user.type(currency, 'usd');

    expect(currency).toHaveValue('USD');
  });

  // ── Gate messaging.manage ─────────────────────────────────────────────────

  it('fields are read-only (not hidden) and there is no Guardar button without messaging.manage', () => {
    setupHooks({ permissions: ['messaging.read'] });
    render(<MessagingRatesCard />);
    expect(screen.getByLabelText(/moneda/i)).toBeDisabled();
    expect(screen.getByLabelText(/utility/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  // ── Guardar: dirty + confirm + mutate ─────────────────────────────────────

  it('Guardar is disabled while the form matches the loaded config', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('a valid edit asks confirmation with the impact copy, then mutates with the exact string payload', async () => {
    const user = userEvent.setup();
    const { mutateRatesFn, confirmFn } = setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '0.0150');

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/bloqueo de env[ií]os masivos/i) }),
    );
    await waitFor(() => {
      expect(mutateRatesFn).toHaveBeenCalledWith({
        currency: 'USD',
        utilityRate: '0.0150',
        marketingRate: '0.0618',
        authenticationRate: '0.0220',
        providerFee: '0.0050',
      });
    });
  });

  it('does NOT mutate when the confirm is cancelled', async () => {
    const user = userEvent.setup();
    const { mutateRatesFn, confirmFn } = setupHooks({ confirmResult: false });
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '0.0150');
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mutateRatesFn).not.toHaveBeenCalled();
  });

  // Finding 12 (fix wave) — antes solo chequeaba role="alert" genérico
  // (tautológico: cualquier error de guardado pasa). Ahora pinea el copy
  // ESPECÍFICO de `mapRatesSaveError` para el 400.
  it('shows the SPECIFIC actionable 400 copy from mapRatesSaveError (not a generic alert)', () => {
    setupHooks({
      setRatesError: true,
      setRatesErrorObj: Object.assign(new Error('bad'), { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } }),
    });
    render(<MessagingRatesCard />);
    expect(
      screen.getByText(
        /las tarifas ingresadas no son válidas: deben ser decimales mayores o iguales a 0 con hasta 4 decimales/i,
      ),
    ).toBeInTheDocument();
  });

  it('full save cycle (reactive mock): success banner appears and Guardar disables again', async () => {
    const user = userEvent.setup();
    setupHooks();
    const reactive = createReactiveRatesMock(RATES);
    vi.mocked(useMessagingRatesConfig).mockImplementation(reactive.useRatesHook);
    vi.mocked(useSetMessagingRatesConfig).mockImplementation(reactive.useSetRatesHook);

    render(<MessagingRatesCard />);
    const utility = screen.getByLabelText(/utility/i);
    const saveBtn = screen.getByRole('button', { name: /guardar/i });

    await user.clear(utility);
    await user.type(utility, '0.0150');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/guardad/i)).toBeInTheDocument(), { timeout: 1000 });
    expect(saveBtn).toBeDisabled();
  });

  // Finding 13a (fix wave) — Save re-enabled after a failed PUT: the user can
  // retry without reloading the page.
  it('finding 13a: after a failed save (reactive mock), Save stays usable and a retry succeeds', async () => {
    const user = userEvent.setup();
    setupHooks();
    const reactive = createReactiveRatesMock(RATES, { shouldFail: true });
    vi.mocked(useMessagingRatesConfig).mockImplementation(reactive.useRatesHook);
    vi.mocked(useSetMessagingRatesConfig).mockImplementation(reactive.useSetRatesHook);

    render(<MessagingRatesCard />);
    const utility = screen.getByLabelText(/utility/i);

    await user.clear(utility);
    await user.type(utility, '0.0150');
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 1000 });

    const saveBtnAfterFailure = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtnAfterFailure).not.toBeDisabled();

    fireEvent.click(saveBtnAfterFailure);
    await waitFor(() => expect(reactive.mutateSpy).toHaveBeenCalledTimes(2));
  });

  // ── Helper por categoría (findings 1 + 7) ─────────────────────────────────

  it('shows a per-category "≈ currency unitCost por mensaje CATEGORY" helper line, tagged "(tarifa vigente)" when clean', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByText(/0\.0170.*UTILITY.*tarifa vigente|UTILITY.*0\.0170.*tarifa vigente/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.0668.*MARKETING|MARKETING.*0\.0668/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.0270.*AUTHENTICATION|AUTHENTICATION.*0\.0270/i)).toBeInTheDocument();
  });

  it('finding 1: the helper reflects the UNSAVED form ("por guardar") while the estimator keeps using the loaded rates + shows a dirty note', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '0.9999');

    // helper: 0.9999 + fee 0.0050 = 1.0049, tagged "por guardar"
    expect(screen.getByText(/1\.0049.*por guardar/i)).toBeInTheDocument();
    expect(screen.getAllByText(/por guardar/i).length).toBeGreaterThan(0);

    // estimator: UNAFFECTED by the unsaved edit — still the LOADED rate (100 * 0.0170 = 1.7000)
    expect(screen.getByText(/1\.7000/)).toBeInTheDocument();
    expect(screen.getByText(/hay cambios sin guardar/i)).toBeInTheDocument();
  });

  it('finding 7: an invalid rate ("-1" / leading-space "0.5") makes the helper show "—" instead of computing', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);
    const utility = screen.getByLabelText(/utility/i);

    await user.clear(utility);
    await user.type(utility, '-1');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    await user.clear(utility);
    await user.type(utility, ' 0.5');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('finding 7 (positive control): a valid-but-odd rate ("01.5", leading zero) still computes normally, no dash', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);
    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, '01.5');

    // 01.5 + fee 0.0050 = 1.5050 — matches RATE_RE, so it computes (not "—")
    expect(screen.getByText(/1\.5050/)).toBeInTheDocument();
  });

  // ── updatedAt (finding 3) ──────────────────────────────────────────────────

  it('finding 3: shows "Tarifas actualizadas el DD/MM/YYYY HH:mm" (es-AR, Buenos Aires) under the form', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    // updatedAt = 2026-09-01T12:00:00.000Z → 09:00 ART (UTC-3), same calendar day
    expect(screen.getByText(/tarifas actualizadas el 01\/09\/2026 09:00/i)).toBeInTheDocument();
  });

  // ── Balance ────────────────────────────────────────────────────────────────

  it('balance: loading state', () => {
    setupHooks({ balanceLoading: true });
    render(<MessagingRatesCard />);
    expect(screen.getByText(/cargando saldo/i)).toBeInTheDocument();
  });

  it('balance: success shows the amount and a refresh button', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByText(/saldo twilio:/i)).toBeInTheDocument();
    expect(screen.getByText(/17\.8940/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeInTheDocument();
  });

  it('balance: cached badge shown when cached=true', () => {
    setupHooks({ balance: { ...BALANCE, cached: true } });
    render(<MessagingRatesCard />);
    expect(screen.getByText(/cach/i)).toBeInTheDocument();
  });

  it('balance: 503/error shows "Saldo no disponible" with retry, WITHOUT breaking the rates form', () => {
    const { refetchBalanceFn } = setupHooks({ balanceError: true });
    render(<MessagingRatesCard />);
    expect(screen.getByText('Saldo no disponible.')).toBeInTheDocument();
    // el form de tarifas se sigue pudiendo editar
    expect(screen.getByLabelText(/moneda/i)).not.toBeDisabled();

    const retryButtons = screen.getAllByRole('button', { name: /reintentar|actualizar/i });
    fireEvent.click(retryButtons[0]);
    expect(refetchBalanceFn).toHaveBeenCalled();
  });

  // Finding 9 (fix wave) — balance.available SIEMPRE pasado por formatMoney,
  // nunca impreso crudo.
  it('finding 9: balance.available is passed through formatMoney (4 dp), not printed raw', () => {
    setupHooks({ balance: { ...BALANCE, available: '17.894' } });
    render(<MessagingRatesCard />);
    expect(screen.getByText(/17\.8940/)).toBeInTheDocument();
  });

  // Finding 13c (fix wave) — balance currency !== rates currency.
  it('finding 13c: balance currency differs from rates currency — both render in their own currency', () => {
    setupHooks({ balance: { ...BALANCE, currency: 'ARS', available: '5000.0000' } });
    render(<MessagingRatesCard />);
    expect(screen.getByText(/ars\s*5000\.0000/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/moneda/i)).toHaveValue('USD');
  });

  // Finding 8 (fix wave) — el relativo del saldo tickea solo (30s), pasa a
  // segundos bajo el minuto, y no queda pegado a un valor estático.
  it('finding 8: the relative "hace…" label ticks every 30s (seconds under a minute)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-01T12:00:10.000Z')); // 10s tras fetchedAt
      setupHooks();
      render(<MessagingRatesCard />);
      expect(screen.getByText(/hace 10 s/)).toBeInTheDocument();

      // avanza el reloj fake 30s (mueve Date.now() Y dispara el setInterval de 30s)
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByText(/hace 40 s/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('finding 8: a future-skewed fetchedAt (clock desync) shows "recién", not a negative', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-01T11:59:00.000Z')); // ANTES de fetchedAt
      setupHooks();
      render(<MessagingRatesCard />);
      expect(screen.getByText(/recién/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Fix wave 2 (minor) — el interval de 30s del label relativo del saldo NO
  // debe arrancar mientras no hay balance (loading/error): nada que tickear.
  it('fix wave 2: does not start the 30s balance-tick interval while there is no balance (error state)', () => {
    vi.useFakeTimers();
    try {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      setupHooks({ balanceError: true });
      render(<MessagingRatesCard />);
      expect(setIntervalSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fix wave 2: starts the 30s balance-tick interval once a balance is present', () => {
    vi.useFakeTimers();
    try {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      setupHooks();
      render(<MessagingRatesCard />);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Estimador ──────────────────────────────────────────────────────────────

  it('estimator: uses a Select combobox, not a native <select>', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByRole('combobox', { name: /categor[ií]a/i })).toBeInTheDocument();
    expect(document.querySelector('select')).not.toBeInTheDocument();
  });

  it('estimator caption states it uses the SAVED rates', () => {
    setupHooks();
    render(<MessagingRatesCard />);
    expect(screen.getByText(/usa las tarifas guardadas/i)).toBeInTheDocument();
  });

  // Findings 10-11 (fix wave) — antes usaba la cantidad/categoría DEFAULT
  // (100/UTILITY) y solo chequeaba /alcanza/i (matchea "NO alcanza" también,
  // tautológico). Ahora usa valores NO-default y pinea el veredicto exacto.
  it('estimator: 250 MARKETING ≈ USD 16.7000, "el saldo alcanza." exactly (non-default quantity + category)', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const qty = screen.getByLabelText(/cantidad/i);
    await user.clear(qty);
    await user.type(qty, '250');

    await user.click(screen.getByRole('combobox', { name: /categor[ií]a/i }));
    await user.click(screen.getByRole('option', { name: /^marketing$/i }));

    // 250 * (0.0618 + 0.0050) = 250 * 0.0668 = 16.7000 <= 17.8940
    // Scoped to the VISIBLE estimator paragraph — el live region sr-only
    // (debounced 400ms) puede terminar mostrando el mismo monto y volver
    // ambiguo un getByText(/16\.7000/) global si pasaron >400ms.
    const result = within(screen.getByTestId('estimator-result'));
    expect(result.getByText(/16\.7000/)).toBeInTheDocument();
    expect(result.getByText(/el saldo alcanza\./)).toBeInTheDocument();
    expect(result.queryByText(/no alcanza/i)).not.toBeInTheDocument();
  });

  it('estimator: insufficient balance states "el saldo NO alcanza." exactly, not a substring match', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const qty = screen.getByLabelText(/cantidad/i);
    await user.clear(qty);
    await user.type(qty, '300');

    await user.click(screen.getByRole('combobox', { name: /categor[ií]a/i }));
    await user.click(screen.getByRole('option', { name: /^marketing$/i }));

    expect(screen.getByText(/el saldo no alcanza\./i)).toBeInTheDocument();
    expect(screen.queryByText(/^el saldo alcanza\./)).not.toBeInTheDocument();
  });

  // Finding 4 (fix wave) — sufficient===null ahora dice explícitamente que
  // el envío se va a BLOQUEAR (moneda distinta o saldo no disponible).
  it('finding 4: sufficient === null states the send WILL be blocked (currency mismatch)', async () => {
    const user = userEvent.setup();
    setupHooks({ balance: { ...BALANCE, currency: 'ARS' } });
    render(<MessagingRatesCard />);

    const qty = screen.getByLabelText(/cantidad/i);
    await user.clear(qty);
    await user.type(qty, '100');

    expect(screen.getByText(/no se puede confirmar el saldo.*bloqueados/i)).toBeInTheDocument();
  });

  // Finding 5 (fix wave) — cantidad inválida: aria-invalid + aria-describedby
  // + role="status", fila de resultado reemplazada por el mensaje.
  describe('finding 5: quantity validation', () => {
    it.each([
      ['empty string', ''],
      ['non-numeric', 'abc'],
      ['scientific notation', '1e5'],
      ['over the 1,000,000 cap', '1000001'],
    ])('invalid quantity (%s: %s) shows the error and marks the input invalid', async (_label, bad) => {
      const user = userEvent.setup();
      setupHooks();
      render(<MessagingRatesCard />);
      const qty = screen.getByLabelText(/cantidad/i);
      await user.clear(qty);
      if (bad !== '') await user.type(qty, bad);

      expect(qty).toHaveAttribute('aria-invalid', 'true');
      const describedById = qty.getAttribute('aria-describedby');
      expect(describedById).toBeTruthy();

      const errorEl = screen.getByText('Ingresá una cantidad entera entre 1 y 1.000.000.');
      expect(errorEl).toHaveAttribute('role', 'status');
      expect(errorEl.id).toBe(describedById);

      // el estimado anterior desaparece — la fila queda reemplazada por el mensaje
      expect(screen.queryByText(/mensajes.*≈/)).not.toBeInTheDocument();
    });
  });

  // Finding 6 (fix wave) — el live region SOLO anuncia 400ms después de la
  // última tecla; typing rápido "1"→"10"→"100" produce UN anuncio final.
  it('finding 6: debounces the announced live region — rapid changes yield a single final announcement', () => {
    vi.useFakeTimers();
    try {
      setupHooks();
      render(<MessagingRatesCard />);
      const qty = screen.getByLabelText(/cantidad/i);
      const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
      expect(live).toBeTruthy();

      act(() => {
        fireEvent.change(qty, { target: { value: '1' } });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        fireEvent.change(qty, { target: { value: '10' } });
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        fireEvent.change(qty, { target: { value: '100' } });
      });

      // todavía dentro de la ventana de debounce desde el ÚLTIMO cambio — nada anunciado
      act(() => {
        vi.advanceTimersByTime(390);
      });
      expect(live.textContent).toBe('');

      // pasa el debounce (400ms desde el último cambio)
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(live.textContent).toContain('1.7000');
      expect(live.textContent).toContain('alcanza');
    } finally {
      vi.useRealTimers();
    }
  });

  // Finding 13b (fix wave) — usuario read-only (solo messaging.read) SÍ puede
  // usar el estimador: sus inputs quedan habilitados, Guardar oculto.
  it('finding 13b: a read-only user (messaging.read only) CAN use the estimator; its inputs stay enabled and Save is hidden', async () => {
    const user = userEvent.setup();
    setupHooks({ permissions: ['messaging.read'] });
    render(<MessagingRatesCard />);

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();

    const qty = screen.getByLabelText(/cantidad/i);
    expect(qty).not.toBeDisabled();
    await user.clear(qty);
    await user.type(qty, '250');

    const combo = screen.getByRole('combobox', { name: /categor[ií]a/i });
    expect(combo).not.toBeDisabled();
    await user.click(combo);
    await user.click(screen.getByRole('option', { name: /^marketing$/i }));

    // Scoped al párrafo visible — mismo motivo que el test de arriba.
    expect(within(screen.getByTestId('estimator-result')).getByText(/16\.7000/)).toBeInTheDocument();
  });

  // ── A11y ───────────────────────────────────────────────────────────────────

  it('associates an inline field error to its input via aria-describedby + aria-invalid', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, 'abc');

    expect(utility).toHaveAttribute('aria-invalid', 'true');
    const describedBy = utility.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
  });

  it('field-level validation errors use role="status", leaving role="alert" for fetch/save failures', async () => {
    const user = userEvent.setup();
    setupHooks();
    render(<MessagingRatesCard />);

    const utility = screen.getByLabelText(/utility/i);
    await user.clear(utility);
    await user.type(utility, 'abc');

    const errorEls = screen.getAllByText(/decimal/i).filter((el) => el.getAttribute('role') === 'status');
    expect(errorEls.length).toBeGreaterThan(0);
  });

  it('moves focus to Guardar after a save error', async () => {
    setupHooks({
      setRatesError: true,
      setRatesErrorObj: Object.assign(new Error('bad'), { response: { status: 400 } }),
    });
    render(<MessagingRatesCard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /guardar/i })).toHaveFocus());
  });
});
