import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/financeGrowth.api';
import type { YearMonthRange } from '@/api/financeGrowth.api';
import type {
  UpdateFinanceTechnologyCostPayload,
  UpdateFinancePlanPricePayload,
  FinanceTargetsConfig,
  UpdateFinanceInflationPayload,
  PatchFinanceInvoiceTypePayload,
} from '@/types/financeGrowth';

/**
 * finance-growth-dashboard (Fase 5) — hooks TanStack Query, un archivo plano
 * por dominio (mismo criterio que useNocAlertThresholds.ts/useBilling.ts).
 * Cada GET es un passthrough tipado del contrato (design.md "HTTP Contract")
 * — nunca transforma/defaultea un campo `number | null` acá; eso es
 * responsabilidad exclusiva de los componentes de presentación (MaybeValue).
 */

export const FINANCE_OVERVIEW_QUERY_KEY = (range: YearMonthRange) => ['finance-growth', 'overview', range] as const;
export const FINANCE_COHORTS_QUERY_KEY = (range: { fromCohort: string; toCohort: string }) =>
  ['finance-growth', 'cohorts', range] as const;
export const FINANCE_CAC_QUERY_KEY = (params: { technology: string; yearMonth: string }) =>
  ['finance-growth', 'cac', params] as const;
export const FINANCE_VENDORS_EARLY_CHURN_QUERY_KEY = (range: YearMonthRange) =>
  ['finance-growth', 'vendors-early-churn', range] as const;
export const FINANCE_NODES_GROWTH_QUERY_KEY = (range: YearMonthRange) =>
  ['finance-growth', 'nodes-growth', range] as const;
export const FINANCE_MOTIVOS_BAJA_QUERY_KEY = (range: YearMonthRange) =>
  ['finance-growth', 'motivos-baja', range] as const;
export const FINANCE_TECHNOLOGY_COSTS_QUERY_KEY = ['finance-growth', 'config', 'technology-costs'] as const;
export const FINANCE_PLAN_PRICES_QUERY_KEY = ['finance-growth', 'config', 'plan-prices'] as const;
export const FINANCE_TARGETS_QUERY_KEY = ['finance-growth', 'config', 'targets'] as const;
export const FINANCE_INFLATION_QUERY_KEY = (range: YearMonthRange) =>
  ['finance-growth', 'config', 'inflation', range] as const;
export const FINANCE_INVOICE_TYPES_QUERY_KEY = ['finance-growth', 'config', 'invoice-types'] as const;
export const FINANCE_SYNC_STATUS_QUERY_KEY = ['finance-growth', 'sync', 'status'] as const;

export function useFinanceOverview(range: YearMonthRange) {
  return useQuery({
    queryKey: FINANCE_OVERVIEW_QUERY_KEY(range),
    queryFn: () => api.getFinanceOverview(range),
    staleTime: 60_000,
  });
}

export function useFinanceCohorts(range: { fromCohort: string; toCohort: string }) {
  return useQuery({
    queryKey: FINANCE_COHORTS_QUERY_KEY(range),
    queryFn: () => api.getFinanceCohorts(range),
    staleTime: 60_000,
  });
}

export function useFinanceCac(params: { technology: string; yearMonth: string }) {
  return useQuery({
    queryKey: FINANCE_CAC_QUERY_KEY(params),
    queryFn: () => api.getFinanceCac(params),
    enabled: params.technology.trim().length > 0 && params.yearMonth.trim().length > 0,
    staleTime: 60_000,
  });
}

export function useFinanceVendorsEarlyChurn(range: YearMonthRange) {
  return useQuery({
    queryKey: FINANCE_VENDORS_EARLY_CHURN_QUERY_KEY(range),
    queryFn: () => api.getFinanceVendorsEarlyChurn(range),
    staleTime: 60_000,
  });
}

export function useFinanceNodesGrowth(range: YearMonthRange) {
  return useQuery({
    queryKey: FINANCE_NODES_GROWTH_QUERY_KEY(range),
    queryFn: () => api.getFinanceNodesGrowth(range),
    staleTime: 60_000,
  });
}

export function useFinanceMotivosBaja(range: YearMonthRange) {
  return useQuery({
    queryKey: FINANCE_MOTIVOS_BAJA_QUERY_KEY(range),
    queryFn: () => api.getFinanceMotivosBaja(range),
    staleTime: 60_000,
  });
}

export function useFinanceTechnologyCosts() {
  return useQuery({
    queryKey: FINANCE_TECHNOLOGY_COSTS_QUERY_KEY,
    queryFn: api.getFinanceTechnologyCosts,
  });
}

export function useUpdateFinanceTechnologyCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      technologyName,
      payload,
    }: {
      technologyName: string;
      payload: UpdateFinanceTechnologyCostPayload;
    }) => api.updateFinanceTechnologyCost(technologyName, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FINANCE_TECHNOLOGY_COSTS_QUERY_KEY });
    },
  });
}

export function useFinancePlanPrices() {
  return useQuery({
    queryKey: FINANCE_PLAN_PRICES_QUERY_KEY,
    queryFn: api.getFinancePlanPrices,
  });
}

export function useUpdateFinancePlanPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planCode, payload }: { planCode: string; payload: UpdateFinancePlanPricePayload }) =>
      api.updateFinancePlanPrice(planCode, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FINANCE_PLAN_PRICES_QUERY_KEY });
    },
  });
}

export function useFinanceTargets() {
  return useQuery({
    queryKey: FINANCE_TARGETS_QUERY_KEY,
    queryFn: api.getFinanceTargets,
  });
}

export function useUpdateFinanceTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FinanceTargetsConfig) => api.updateFinanceTargets(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FINANCE_TARGETS_QUERY_KEY });
    },
  });
}

export function useFinanceInflation(range: YearMonthRange) {
  return useQuery({
    queryKey: FINANCE_INFLATION_QUERY_KEY(range),
    queryFn: () => api.getFinanceInflation(range),
  });
}

export function useUpdateFinanceInflation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearMonth, payload }: { yearMonth: string; payload: UpdateFinanceInflationPayload }) =>
      api.updateFinanceInflation(yearMonth, payload),
    onSuccess: () => {
      // El rango consultado es dinámico (query key incluye {from,to}) — invalidamos
      // por prefijo ['finance-growth','config','inflation'] para cubrir cualquier
      // rango montado, mismo criterio que un `predicate` de invalidación por familia.
      void qc.invalidateQueries({ queryKey: ['finance-growth', 'config', 'inflation'] });
    },
  });
}

export function useFinanceInvoiceTypes() {
  return useQuery({
    queryKey: FINANCE_INVOICE_TYPES_QUERY_KEY,
    queryFn: api.getFinanceInvoiceTypes,
  });
}

export function usePatchFinanceInvoiceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grType, payload }: { grType: string; payload: PatchFinanceInvoiceTypePayload }) =>
      api.patchFinanceInvoiceType(grType, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FINANCE_INVOICE_TYPES_QUERY_KEY });
    },
  });
}

export function useFinanceSyncStatus(options?: { pollingMs?: number }) {
  return useQuery({
    queryKey: FINANCE_SYNC_STATUS_QUERY_KEY,
    queryFn: api.getFinanceSyncStatus,
    refetchInterval: options?.pollingMs,
  });
}

export function useRunFinanceSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.runFinanceSync,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FINANCE_SYNC_STATUS_QUERY_KEY });
    },
  });
}
