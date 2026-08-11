import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceOverviewResponse, FinanceSyncStatusResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceOverview: vi.fn(),
  useFinanceSyncStatus: vi.fn(),
  useRunFinanceSync: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import {
  useFinanceOverview,
  useFinanceSyncStatus,
  useRunFinanceSync,
} from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import FinanceGrowthOverviewPage from './FinanceGrowthOverviewPage';

function mockPermissions(allow: (perm: string) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => (Array.isArray(permission) ? permission : [permission]).some(allow),
  });
}

function mockSyncHooks() {
  vi.mocked(useFinanceSyncStatus).mockReturnValue({
    data: undefined,
    isLoading: true,
  } as unknown as UseQueryResult<FinanceSyncStatusResponse>);
  vi.mocked(useRunFinanceSync).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  } as unknown as ReturnType<typeof useRunFinanceSync>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mockSyncHooks();
});

describe('FinanceGrowthOverviewPage — 4 estados', () => {
  it('loading: muestra un skeleton anunciado (role=status), nunca una pantalla en blanco', () => {
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument();
  });

  it('error: role=alert + botón de reintento que llama refetch', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty (dark): meses sin snapshot calculado se explican, NUNCA una tabla en blanco muda', () => {
    const emptyResponse: FinanceOverviewResponse = {
      months: [],
      monthsWithoutSnapshot: ['2026-06', '2026-07'],
      realSeriesMissingMonths: ['2026-06', '2026-07'],
      inflationBaseYearMonth: '',
      metricBasis: 'cash_collected',
    };
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/todav[ií]a no se calcul[oó]/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/jun 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/jul 2026/).length).toBeGreaterThan(0);
  });

  it('success: declara metricBasis, muestra el disclaimer de cobranza real y nunca convierte churnRevenuePct null en "0.0%"', () => {
    const successResponse: FinanceOverviewResponse = {
      months: [
        {
          yearMonth: '2026-07',
          contractsActive: 100,
          contractsNew: 5,
          contractsChurned: 2,
          contractsUpgraded: 1,
          contractsDowngraded: 0,
          mrrInicialArs: 1_000_000,
          mrrNewArs: 50_000,
          mrrUpgradeArs: 0,
          mrrDowngradeArs: 0,
          mrrChurnArs: 20_000,
          mrrFinalArs: 1_030_000,
          mrrFinalRealArs: null,
          bridgeResidualArs: 0,
          // Coherente con mrrFinalArs > 0: sólo una MINORÍA de contratos está
          // sin precio (no el 100% — ese caso, contradictorio con un MRR > 0,
          // tiene su propio test dedicado más abajo: "estado real de prod").
          unpricedContractsActive: 12,
          unpricedContractsPct: 12,
          unpricedPlanChangeEvents: 0,
          enforcementPlanChangeEventsExcluded: 0,
          revenueTotalArs: 980_000,
          revenueTotalRealArs: null,
          collectionRatePct: 95.1,
          revenueAttributableArs: 950_000,
          unclassifiedAmountArs: 0,
          attributionPct: 96.9,
          arpuArs: 9_800,
          churnContractsPct: 2,
          churnRevenuePct: null,
        },
      ],
      monthsWithoutSnapshot: [],
      realSeriesMissingMonths: ['2026-07'],
      inflationBaseYearMonth: '',
      metricBasis: 'cash_collected',
    };
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: successResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );

    // Disclaimer de metodología, siempre visible (no un tooltip escondido).
    // (Regex acotada a la frase completa del disclaimer — "cobranza real" a
    // secas ahora también matchea el KPI tile "Cobranza real (cash
    // collected)" agregado por el fix del bloqueante 🔴1(d), así que
    // `getByText` tiraría "multiple elements found" con una regex más laxa.)
    expect(screen.getByText(/plata efectivamente cobrada/i)).toBeInTheDocument();
    expect(screen.getByText(/no.*facturaci[oó]n emitida/i)).toBeInTheDocument();

    // 12/100 sin precio (parcial) tiene que decir "faltan precios".
    expect(screen.getByText(/12 contratos activos/)).toBeInTheDocument();
    expect(screen.getByText(/falta[n]? (cargar )?precio/i)).toBeInTheDocument();

    // El MRR SÍ es un número real acá (sólo 12% sin precio, no el 100%) — se
    // muestra el monto en el KPI tile, no "—" (el mismo monto también
    // aparece en "= MRR final" del bridge, así que se acota la búsqueda al
    // tile para no ambigüar contra esa otra fila).
    const mrrKpiTile = screen.getByText(/^mrr contratado/i).closest('div')!;
    expect(mrrKpiTile.textContent).toMatch(/\$\s*1\.030\.000,00/);
    expect(mrrKpiTile.textContent).not.toContain('—');

    // churnRevenuePct null nunca se ve como "0.0%" en el DOM (formato real
    // que produce `pct()` — la versión previa de este test comparaba contra
    // '0%', que `pct` JAMÁS produce, así que la aserción nunca podía fallar).
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('estado real de prod HOY — 100% de los contratos sin precio Y cobranza sin ingerir: el Resumen dice la verdad, no miente con $0 (bloqueante 🔴1)', () => {
    // Fixture EXACTA del review adversarial (DOM capturado contra prod real,
    // 2026-07-27): mrrFinalArs=0, unpricedContractsActive=394,
    // unpricedContractsPct=100, revenueTotalArs=0. La versión anterior de
    // este fixture era CONTRADICTORIA (100% sin precio + mrrFinalArs>0), lo
    // que ocultaba este bug exacto.
    const prodResponse: FinanceOverviewResponse = {
      months: [
        {
          yearMonth: '2026-07',
          contractsActive: 394,
          contractsNew: 8,
          contractsChurned: 3,
          contractsUpgraded: 0,
          contractsDowngraded: 0,
          mrrInicialArs: 0,
          mrrNewArs: 0,
          mrrUpgradeArs: 0,
          mrrDowngradeArs: 0,
          mrrChurnArs: 0,
          mrrFinalArs: 0,
          mrrFinalRealArs: null,
          bridgeResidualArs: 0,
          unpricedContractsActive: 394,
          unpricedContractsPct: 100,
          unpricedPlanChangeEvents: 0,
          enforcementPlanChangeEventsExcluded: 0,
          revenueTotalArs: 0,
          revenueTotalRealArs: null,
          collectionRatePct: null,
          revenueAttributableArs: 0,
          unclassifiedAmountArs: 0,
          attributionPct: 0,
          arpuArs: 0,
          churnContractsPct: 0.8,
          // El BE manda un NÚMERO real (0), no null — el bug es que el FE lo
          // pintaba al lado de "Churn contratos 0.8%" como si fueran
          // comparables, sin usar unpricedContractsPct===100 para desambiguar.
          churnRevenuePct: 0,
        },
      ],
      monthsWithoutSnapshot: [],
      realSeriesMissingMonths: ['2026-07'],
      inflationBaseYearMonth: '',
      metricBasis: 'cash_collected',
    };
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: prodResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    const { container } = render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );

    // (b) El banner de precios aparece ANTES que el KPI de MRR en el DOM —
    // el usuario tiene que leer la advertencia ANTES que cualquier número.
    const html = container.innerHTML;
    const bannerIdx = html.indexOf('Faltan precios');
    const mrrTileIdx = html.indexOf('MRR contratado');
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeLessThan(mrrTileIdx);

    // (a) MRR contratado NUNCA se ve como "$0,00" cuando el 100% de los
    // contratos no tiene precio — es "—" (desconocido), no cero medido.
    const mrrLabel = screen.getByText(/^mrr contratado/i);
    const mrrTile = mrrLabel.closest('div')!;
    expect(mrrTile.textContent).toContain('—');
    expect(mrrTile.textContent).not.toMatch(/\$\s*0,00/);

    // Churn ingresos TAMPOCO se pinta como "0.0%" comparable a "Churn
    // contratos 0.8%" — incluso siendo un número real (0) del BE, el 100%
    // sin precio lo vuelve no medible.
    const churnRevenueLabel = screen.getByText(/^churn ingresos/i);
    const churnRevenueTile = churnRevenueLabel.closest('div')!;
    expect(churnRevenueTile.textContent).toContain('—');
    expect(churnRevenueTile.textContent).not.toMatch(/0[.,]0%/);
    // Y el churn de CONTRATOS (que sí es medible) sigue viéndose, sin que la
    // desambiguación de arriba se lo lleve puesto.
    expect(screen.getByText('0.8%')).toBeInTheDocument();

    // (c) Un banner explica que la cobranza no se ingirió — cubre ARPU y
    // churn de ingresos — en NINGUNA otra página de este change existía.
    expect(screen.getByText(/cobranza no ingerida todav[ií]a/i)).toBeInTheDocument();

    // (d) La cobranza real (revenueTotalArs) SE RENDERIZA en algún lado —
    // antes del fix no aparecía en NINGUNA página del change.
    expect(screen.getByText(/cobranza real \(cash collected\)/i)).toBeInTheDocument();
  });

  it('pacing.enabled === false: NO dice "Sincronización al día" en verde, dice "Ingesta apagada", y el botón se deshabilita (bloqueante 🔴3)', () => {
    // Estado reproducido del review adversarial: pacing degraded=false pero
    // enabled=false (kill-switch apagado a propósito) + el job de snapshots
    // viene fallando. Antes del fix, pacing.enabled ni existía en el tipo —
    // el componente sólo miraba `degraded` y pintaba verde igual.
    const status: FinanceSyncStatusResponse = {
      pacing: {
        requestIntervalMs: 20000,
        effectiveIntervalMs: 20000,
        degraded: false,
        consecutiveFailures: 0,
        activeLane: 'idle',
        enabled: false,
      },
      delta: { lastRunAt: null, lastResult: null, itemsSynced: 0, pendingPages: false, coveredThroughDate: null },
      backfill: { lastRunAt: null, lastResult: null, itemsSynced: 0, cursorYearMonth: null, cursorPageOffset: 0, done: false },
      reconcile: { lastRunAt: null, lastResult: null, itemsSynced: 0, sweepInProgress: false, windowFrom: null, windowTo: null, pageOffset: 0 },
      debtorBalances: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
      snapshotJob: { lastRunAt: null, lastResult: 'ERROR: connection refused', itemsSynced: 0 },
    };
    vi.mocked(useFinanceSyncStatus).mockReturnValue({
      data: status,
      isLoading: false,
    } as unknown as UseQueryResult<FinanceSyncStatusResponse>);
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/sincronizaci[oó]n al d[ií]a/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ingesta apagada/i)).toBeInTheDocument();
    const syncBtn = screen.getByRole('button', { name: /sincronizar ahora/i });
    expect(syncBtn).toBeDisabled();
    expect(syncBtn).toHaveAttribute('title', expect.stringMatching(/apagada/i));
  });

  it('el 503 SCHEDULER_NOT_RUNNING NO dice "reintentá en unos segundos" (ese consejo es falso — nunca va a funcionar) (bloqueante 🔴3)', () => {
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);
    vi.mocked(useRunFinanceSync).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      error: { response: { status: 503, data: { code: 'SCHEDULER_NOT_RUNNING', error: 'finance receipt ingest scheduler is not running' } } },
    } as unknown as ReturnType<typeof useRunFinanceSync>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/reintent[aá].*en unos segundos/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/apagada/i);
  });

  it('un error de sync genérico (no 503 SCHEDULER_NOT_RUNNING) sigue sugiriendo reintentar', () => {
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);
    vi.mocked(useRunFinanceSync).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      error: { response: { status: 500, data: {} } },
    } as unknown as ReturnType<typeof useRunFinanceSync>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/reintent[aá].*en unos segundos/i);
  });

  it('la sección de sync sólo aparece con permiso finance.sync', () => {
    mockPermissions((perm) => perm !== 'finance.sync');
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    render(
      <MemoryRouter>
        <FinanceGrowthOverviewPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /sincronizar ahora/i })).not.toBeInTheDocument();
  });
});

/**
 * combo-balance-honesto FB2 — finance-sync-lane-visibility (RUN-1, ERR-1,
 * ERR-2). `gr-receipt-annulment` (BE, prod desde 2026-08-10) agregó el
 * carril `reconcile`: un barrido en curso NO debe leerse como "sistema
 * quieto", y un ABORT del guard de anulaciones NO debe leerse como "ritmo
 * degradado" genérico (design.md §7).
 */
function baseSyncStatus(overrides: {
  pacing?: Partial<FinanceSyncStatusResponse['pacing']>;
  delta?: Partial<FinanceSyncStatusResponse['delta']>;
  reconcile?: Partial<FinanceSyncStatusResponse['reconcile']>;
} = {}): FinanceSyncStatusResponse {
  return {
    pacing: {
      requestIntervalMs: 20000,
      effectiveIntervalMs: 20000,
      degraded: false,
      consecutiveFailures: 0,
      activeLane: 'idle',
      enabled: true,
      ...overrides.pacing,
    },
    delta: {
      lastRunAt: null,
      lastResult: null,
      itemsSynced: 0,
      pendingPages: false,
      coveredThroughDate: null,
      ...overrides.delta,
    },
    backfill: { lastRunAt: null, lastResult: null, itemsSynced: 0, cursorYearMonth: null, cursorPageOffset: 0, done: false },
    reconcile: {
      lastRunAt: null,
      lastResult: null,
      itemsSynced: 0,
      sweepInProgress: false,
      windowFrom: null,
      windowTo: null,
      pageOffset: 0,
      ...overrides.reconcile,
    },
    debtorBalances: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
    snapshotJob: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
  };
}

function renderSyncPanel(status: FinanceSyncStatusResponse) {
  vi.mocked(useFinanceSyncStatus).mockReturnValue({
    data: status,
    isLoading: false,
  } as unknown as UseQueryResult<FinanceSyncStatusResponse>);
  vi.mocked(useFinanceOverview).mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<FinanceOverviewResponse>);

  render(
    <MemoryRouter>
      <FinanceGrowthOverviewPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthOverviewPage — RUN-1: reconcile.sweepInProgress cuenta como sincronización activa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions();
    mockSyncHooks();
  });

  it('reconcile.sweepInProgress: true + delta.pendingPages: false → botón "Sincronizando…" deshabilitado', () => {
    renderSyncPanel(baseSyncStatus({ delta: { pendingPages: false }, reconcile: { sweepInProgress: true } }));

    const btn = screen.getByRole('button', { name: /sincronizando/i });
    expect(btn).toBeDisabled();
  });

  it('delta.pendingPages: true (no-regresión) sigue deshabilitando el botón', () => {
    renderSyncPanel(baseSyncStatus({ delta: { pendingPages: true }, reconcile: { sweepInProgress: false } }));

    const btn = screen.getByRole('button', { name: /sincronizando/i });
    expect(btn).toBeDisabled();
  });

  it('sin carriles activos y pacing.enabled: true → "Sincronizar ahora" habilitado', () => {
    renderSyncPanel(
      baseSyncStatus({
        pacing: { enabled: true },
        delta: { pendingPages: false },
        reconcile: { sweepInProgress: false },
      }),
    );

    const btn = screen.getByRole('button', { name: /sincronizar ahora/i });
    expect(btn).toBeEnabled();
  });

  it('el kill-switch (pacing.enabled: false) sigue ganando sobre el estado de carril', () => {
    renderSyncPanel(
      baseSyncStatus({
        pacing: { enabled: false },
        reconcile: { sweepInProgress: false },
      }),
    );

    const btn = screen.getByRole('button', { name: /sincronizar ahora/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringMatching(/apagada/i));
  });
});

describe('FinanceGrowthOverviewPage — ERR-1/ERR-2: falla del carril de reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions();
    mockSyncHooks();
  });

  const GUARD_ABORT_MSG = 'error: guard abort … [aborts consecutivos del guard en este barrido: 2]';

  it('reconcile.lastResult con prefijo "error:" → estado dedicado CON el mensaje, sin "Sincronización al día"', () => {
    renderSyncPanel(
      baseSyncStatus({
        pacing: { enabled: true, degraded: false },
        reconcile: { lastResult: GUARD_ABORT_MSG },
      }),
    );

    expect(screen.getByText(new RegExp(GUARD_ABORT_MSG.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.queryByText(/sincronizaci[oó]n al d[ií]a/i)).not.toBeInTheDocument();
  });

  it('el estado de error del reconcile NO se confunde con "Ritmo degradado"', () => {
    renderSyncPanel(
      baseSyncStatus({
        pacing: { enabled: true, degraded: false },
        reconcile: { lastResult: GUARD_ABORT_MSG },
      }),
    );

    expect(screen.queryByText(/ritmo degradado/i)).not.toBeInTheDocument();
  });

  it('un resultado exitoso (sin prefijo "error:") NO dispara el estado de error del reconcile', () => {
    renderSyncPanel(baseSyncStatus({ reconcile: { lastResult: 'page ok @200' } }));

    expect(screen.getByText(/sincronizaci[oó]n al d[ií]a/i)).toBeInTheDocument();
  });

  it('reconcile.lastResult: null (nunca corrió) no dispara el estado de error', () => {
    renderSyncPanel(baseSyncStatus({ reconcile: { lastResult: null } }));

    expect(screen.getByText(/sincronizaci[oó]n al d[ií]a/i)).toBeInTheDocument();
  });

  it('precedencia: el kill-switch apagado gana sobre el error del reconcile', () => {
    renderSyncPanel(
      baseSyncStatus({
        pacing: { enabled: false },
        reconcile: { lastResult: GUARD_ABORT_MSG },
      }),
    );

    expect(screen.getByText(/ingesta apagada/i)).toBeInTheDocument();
    expect(screen.queryByText(/sincronizaci[oó]n al d[ií]a/i)).not.toBeInTheDocument();
  });

  it('el aviso de error del reconcile vive dentro de la región aria-live="polite" existente', () => {
    renderSyncPanel(baseSyncStatus({ reconcile: { lastResult: GUARD_ABORT_MSG } }));

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live!.textContent).toMatch(/aborts consecutivos/i);
  });

  it('ERR-2: status SIN el bloque reconcile no rompe la página — running cae a delta.pendingPages, sin badge de error', () => {
    const status = baseSyncStatus({ delta: { pendingPages: true } });
    const { reconcile: _reconcile, ...statusWithoutReconcile } = status;
    vi.mocked(useFinanceSyncStatus).mockReturnValue({
      data: statusWithoutReconcile as unknown as FinanceSyncStatusResponse,
      isLoading: false,
    } as unknown as UseQueryResult<FinanceSyncStatusResponse>);
    vi.mocked(useFinanceOverview).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceOverviewResponse>);

    expect(() =>
      render(
        <MemoryRouter>
          <FinanceGrowthOverviewPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();

    expect(screen.getByRole('button', { name: /sincronizando/i })).toBeDisabled();
    expect(screen.queryByText(/reconciliaci[oó]n con error/i)).not.toBeInTheDocument();
  });
});
