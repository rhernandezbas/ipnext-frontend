import axiosClient from './axios-client';
import type {
  FinanceOverviewResponse,
  FinanceCohortsResponse,
  FinanceCacResponse,
  FinanceVendorsEarlyChurnResponse,
  FinanceNodesGrowthResponse,
  FinanceMotivosBajaResponse,
  FinanceTechnologyCostsResponse,
  UpdateFinanceTechnologyCostPayload,
  FinanceTechnologyCost,
  FinancePlanPricesResponse,
  UpdateFinancePlanPricePayload,
  FinancePlanPrice,
  FinanceTargetsConfig,
  FinanceInflationResponse,
  UpdateFinanceInflationPayload,
  FinanceInflationEntry,
  FinanceInvoiceTypesResponse,
  PatchFinanceInvoiceTypePayload,
  FinanceInvoiceType,
  FinanceSyncRunResponse,
  FinanceSyncStatusResponse,
} from '@/types/financeGrowth';

const BASE = '/finance/growth';

export interface YearMonthRange {
  from: string;
  to: string;
}

export const getFinanceOverview = (range: YearMonthRange) =>
  axiosClient
    .get<FinanceOverviewResponse>(`${BASE}/overview`, { params: range })
    .then((r) => r.data);

export const getFinanceCohorts = (range: { fromCohort: string; toCohort: string }) =>
  axiosClient
    .get<FinanceCohortsResponse>(`${BASE}/cohorts`, { params: range })
    .then((r) => r.data);

export const getFinanceCac = (params: { technology: string; yearMonth: string }) =>
  axiosClient.get<FinanceCacResponse>(`${BASE}/cac`, { params }).then((r) => r.data);

export const getFinanceVendorsEarlyChurn = (range: YearMonthRange) =>
  axiosClient
    .get<FinanceVendorsEarlyChurnResponse>(`${BASE}/vendors/early-churn`, { params: range })
    .then((r) => r.data);

export const getFinanceNodesGrowth = (range: YearMonthRange) =>
  axiosClient
    .get<FinanceNodesGrowthResponse>(`${BASE}/nodes/growth`, { params: range })
    .then((r) => r.data);

export const getFinanceMotivosBaja = (range: YearMonthRange) =>
  axiosClient
    .get<FinanceMotivosBajaResponse>(`${BASE}/motivos-baja`, { params: range })
    .then((r) => r.data);

export const getFinanceTechnologyCosts = () =>
  axiosClient
    .get<FinanceTechnologyCostsResponse>(`${BASE}/config/technology-costs`)
    .then((r) => r.data);

export const updateFinanceTechnologyCost = (
  technologyName: string,
  payload: UpdateFinanceTechnologyCostPayload,
) =>
  axiosClient
    .put<FinanceTechnologyCost>(
      `${BASE}/config/technology-costs/${encodeURIComponent(technologyName)}`,
      payload,
    )
    .then((r) => r.data);

export const getFinancePlanPrices = () =>
  axiosClient.get<FinancePlanPricesResponse>(`${BASE}/config/plan-prices`).then((r) => r.data);

export const updateFinancePlanPrice = (planCode: string, payload: UpdateFinancePlanPricePayload) =>
  axiosClient
    .put<FinancePlanPrice>(`${BASE}/config/plan-prices/${encodeURIComponent(planCode)}`, payload)
    .then((r) => r.data);

export const getFinanceTargets = () =>
  axiosClient.get<FinanceTargetsConfig>(`${BASE}/config/targets`).then((r) => r.data);

export const updateFinanceTargets = (payload: FinanceTargetsConfig) =>
  axiosClient.put<FinanceTargetsConfig>(`${BASE}/config/targets`, payload).then((r) => r.data);

export const getFinanceInflation = (range: YearMonthRange) =>
  axiosClient
    .get<FinanceInflationResponse>(`${BASE}/config/inflation`, { params: range })
    .then((r) => r.data);

export const updateFinanceInflation = (yearMonth: string, payload: UpdateFinanceInflationPayload) =>
  axiosClient
    .put<FinanceInflationEntry>(`${BASE}/config/inflation/${encodeURIComponent(yearMonth)}`, payload)
    .then((r) => r.data);

export const getFinanceInvoiceTypes = () =>
  axiosClient.get<FinanceInvoiceTypesResponse>(`${BASE}/config/invoice-types`).then((r) => r.data);

export const patchFinanceInvoiceType = (grType: string, payload: PatchFinanceInvoiceTypePayload) =>
  axiosClient
    .patch<FinanceInvoiceType>(`${BASE}/config/invoice-types/${encodeURIComponent(grType)}`, payload)
    .then((r) => r.data);

export const runFinanceSync = () =>
  axiosClient.post<FinanceSyncRunResponse>(`${BASE}/sync/run`).then((r) => r.data);

export const getFinanceSyncStatus = () =>
  axiosClient.get<FinanceSyncStatusResponse>(`${BASE}/sync/status`).then((r) => r.data);
