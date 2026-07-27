import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/financeGrowth.api', () => ({
  getFinanceOverview: vi.fn(),
  getFinanceCohorts: vi.fn(),
  getFinanceCac: vi.fn(),
  getFinanceVendorsEarlyChurn: vi.fn(),
  getFinanceNodesGrowth: vi.fn(),
  getFinanceMotivosBaja: vi.fn(),
  getFinanceTechnologyCosts: vi.fn(),
  updateFinanceTechnologyCost: vi.fn(),
  getFinancePlanPrices: vi.fn(),
  updateFinancePlanPrice: vi.fn(),
  getFinanceTargets: vi.fn(),
  updateFinanceTargets: vi.fn(),
  getFinanceInflation: vi.fn(),
  updateFinanceInflation: vi.fn(),
  getFinanceInvoiceTypes: vi.fn(),
  patchFinanceInvoiceType: vi.fn(),
  runFinanceSync: vi.fn(),
  getFinanceSyncStatus: vi.fn(),
}));

import * as api from '@/api/financeGrowth.api';
import {
  useFinanceOverview,
  useFinanceTechnologyCosts,
  useUpdateFinanceTechnologyCost,
  useFinancePlanPrices,
  useUpdateFinancePlanPrice,
  useFinanceTargets,
  useUpdateFinanceTargets,
  useFinanceInflation,
  useUpdateFinanceInflation,
  useFinanceInvoiceTypes,
  usePatchFinanceInvoiceType,
  useFinanceSyncStatus,
  useRunFinanceSync,
  FINANCE_TECHNOLOGY_COSTS_QUERY_KEY,
  FINANCE_PLAN_PRICES_QUERY_KEY,
  FINANCE_TARGETS_QUERY_KEY,
  FINANCE_INVOICE_TYPES_QUERY_KEY,
  FINANCE_SYNC_STATUS_QUERY_KEY,
} from '@/hooks/useFinanceGrowth';
import type { FinanceOverviewResponse, FinanceSyncStatusResponse } from '@/types/financeGrowth';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeWrapperWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const w = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper: w };
}

beforeEach(() => {
  vi.clearAllMocks();
});

const OVERVIEW_FIXTURE: FinanceOverviewResponse = {
  months: [],
  monthsWithoutSnapshot: ['2026-06', '2026-07'],
  realSeriesMissingMonths: ['2026-01', '2026-07'],
  inflationBaseYearMonth: '',
  metricBasis: 'cash_collected',
};

describe('useFinanceOverview', () => {
  it('passes the from/to range through and returns the honesty fields untouched', async () => {
    vi.mocked(api.getFinanceOverview).mockResolvedValue(OVERVIEW_FIXTURE);

    const { result } = renderHook(() => useFinanceOverview({ from: '2026-01', to: '2026-07' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getFinanceOverview).toHaveBeenCalledWith({ from: '2026-01', to: '2026-07' });
    // Nunca se "arregla" un cero ni se filtra realSeriesMissingMonths: el hook es un passthrough tipado.
    expect(result.current.data?.realSeriesMissingMonths).toEqual(['2026-01', '2026-07']);
    expect(result.current.data?.monthsWithoutSnapshot).toEqual(['2026-06', '2026-07']);
  });

  it('surfaces error state when the request fails, never a silent empty result', async () => {
    vi.mocked(api.getFinanceOverview).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useFinanceOverview({ from: '2026-01', to: '2026-07' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useFinanceTechnologyCosts / useUpdateFinanceTechnologyCost', () => {
  it('fetches the list', async () => {
    vi.mocked(api.getFinanceTechnologyCosts).mockResolvedValue({ technologies: [] });
    const { result } = renderHook(() => useFinanceTechnologyCosts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getFinanceTechnologyCosts).toHaveBeenCalledTimes(1);
  });

  it('mutation calls PUT with technologyName + payload and invalidates the list', async () => {
    vi.mocked(api.updateFinanceTechnologyCost).mockResolvedValue({
      technologyName: 'Fibra',
      costoVentaArs: 1000,
      costoInstalacionArs: 2000,
      costoMensualServicioArs: 0,
      comisionVentaPct: 5,
      updatedAt: '2026-07-27T00:00:00.000Z',
    });
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateFinanceTechnologyCost(), { wrapper: w });

    result.current.mutate({
      technologyName: 'Fibra',
      payload: {
        costoVentaArs: 1000,
        costoInstalacionArs: 2000,
        costoMensualServicioArs: 0,
        comisionVentaPct: 5,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateFinanceTechnologyCost).toHaveBeenCalledWith('Fibra', {
      costoVentaArs: 1000,
      costoInstalacionArs: 2000,
      costoMensualServicioArs: 0,
      comisionVentaPct: 5,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FINANCE_TECHNOLOGY_COSTS_QUERY_KEY });
  });
});

describe('useFinancePlanPrices / useUpdateFinancePlanPrice', () => {
  it('fetches the list', async () => {
    vi.mocked(api.getFinancePlanPrices).mockResolvedValue({ plans: [] });
    const { result } = renderHook(() => useFinancePlanPrices(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('mutation invalidates the plan-prices list on success', async () => {
    vi.mocked(api.updateFinancePlanPrice).mockResolvedValue({
      planCode: 'IP-100',
      planName: 'IP-100',
      estimatedMonthlyPrice: 15000,
      updatedAt: '2026-07-27T00:00:00.000Z',
    });
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateFinancePlanPrice(), { wrapper: w });

    result.current.mutate({ planCode: 'IP-100', payload: { estimatedMonthlyPrice: 15000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateFinancePlanPrice).toHaveBeenCalledWith('IP-100', { estimatedMonthlyPrice: 15000 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FINANCE_PLAN_PRICES_QUERY_KEY });
  });
});

describe('useFinanceTargets / useUpdateFinanceTargets', () => {
  it('fetches the singleton', async () => {
    vi.mocked(api.getFinanceTargets).mockResolvedValue({
      churnTargetPct: 5,
      maxPaybackMonths: 12,
      monthlyNewContractsGoal: 100,
      inflationBaseYearMonth: '',
    });
    const { result } = renderHook(() => useFinanceTargets(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('mutation invalidates targets on success', async () => {
    const payload = {
      churnTargetPct: 5,
      maxPaybackMonths: 12,
      monthlyNewContractsGoal: 100,
      inflationBaseYearMonth: '2026-01',
    };
    vi.mocked(api.updateFinanceTargets).mockResolvedValue(payload);
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateFinanceTargets(), { wrapper: w });

    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FINANCE_TARGETS_QUERY_KEY });
  });
});

describe('useFinanceInflation / useUpdateFinanceInflation', () => {
  it('fetches the range', async () => {
    vi.mocked(api.getFinanceInflation).mockResolvedValue({ index: [] });
    const { result } = renderHook(() => useFinanceInflation({ from: '2026-01', to: '2026-07' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getFinanceInflation).toHaveBeenCalledWith({ from: '2026-01', to: '2026-07' });
  });

  it('mutation invalidates the inflation query key prefix on success', async () => {
    vi.mocked(api.updateFinanceInflation).mockResolvedValue({
      yearMonth: '2026-06',
      monthlyRatePct: 4.2,
      source: 'INDEC',
    });
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateFinanceInflation(), { wrapper: w });

    result.current.mutate({ yearMonth: '2026-06', payload: { monthlyRatePct: 4.2, source: 'INDEC' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useFinanceInvoiceTypes / usePatchFinanceInvoiceType', () => {
  it('fetches the catalog', async () => {
    vi.mocked(api.getFinanceInvoiceTypes).mockResolvedValue({ types: [] });
    const { result } = renderHook(() => useFinanceInvoiceTypes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('mutation invalidates the catalog on success', async () => {
    vi.mocked(api.patchFinanceInvoiceType).mockResolvedValue({
      grType: 'XZ',
      bucket: 'revenue',
      label: null,
      updatedAt: '2026-07-27T00:00:00.000Z',
    });
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => usePatchFinanceInvoiceType(), { wrapper: w });

    result.current.mutate({ grType: 'XZ', payload: { bucket: 'revenue' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FINANCE_INVOICE_TYPES_QUERY_KEY });
  });
});

describe('useFinanceSyncStatus / useRunFinanceSync', () => {
  const STATUS_FIXTURE: FinanceSyncStatusResponse = {
    pacing: {
      requestIntervalMs: 20000,
      effectiveIntervalMs: 20000,
      degraded: false,
      consecutiveFailures: 0,
      activeLane: 'idle',
      enabled: true,
    },
    delta: { lastRunAt: null, lastResult: null, itemsSynced: 0, pendingPages: false, coveredThroughDate: null },
    backfill: { lastRunAt: null, lastResult: null, itemsSynced: 0, cursorYearMonth: '2026-07', cursorPageOffset: 0, done: false },
    debtorBalances: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
    snapshotJob: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
  };

  it('polls sync status', async () => {
    vi.mocked(api.getFinanceSyncStatus).mockResolvedValue(STATUS_FIXTURE);
    const { result } = renderHook(() => useFinanceSyncStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pacing.activeLane).toBe('idle');
  });

  it('run mutation invalidates sync status on success', async () => {
    vi.mocked(api.runFinanceSync).mockResolvedValue({ started: true });
    const { qc, wrapper: w } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRunFinanceSync(), { wrapper: w });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FINANCE_SYNC_STATUS_QUERY_KEY });
  });
});
