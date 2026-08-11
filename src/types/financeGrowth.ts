/**
 * finance-growth-dashboard (Fase 5, FE) — tipos tipados CAMPO POR CAMPO contra
 * el contrato HTTP real del BE (openspec/changes/finance-growth-dashboard/design.md,
 * sección "HTTP Contract (BE↔FE, campo por campo)", fix-wave-4 ya incorporado).
 *
 * Regla de oro de este módulo: un campo `number | null` en el contrato NUNCA se
 * angosta a `number` acá ni se defaultea con `?? 0` en ningún consumidor — `null`
 * quiere decir "no sé", no "cero". Ver design.md Decision 0c/1b/4b y el brief de
 * Fase 5 ("la honestidad de los números").
 */

export type AttributionConfidence = 'exact' | 'estimated' | 'estimated-equal';
export type InvoiceTypeBucket = 'revenue' | 'contra' | 'excluded' | 'unclassified';

export interface FinanceOverviewMonth {
  yearMonth: string;
  contractsActive: number;
  contractsNew: number;
  contractsChurned: number;
  contractsUpgraded: number;
  contractsDowngraded: number;
  mrrInicialArs: number;
  mrrNewArs: number;
  mrrUpgradeArs: number;
  mrrDowngradeArs: number;
  mrrChurnArs: number;
  mrrFinalArs: number;
  mrrFinalRealArs: number | null;
  bridgeResidualArs: number;
  unpricedContractsActive: number;
  unpricedContractsPct: number;
  unpricedPlanChangeEvents: number;
  enforcementPlanChangeEventsExcluded: number;
  revenueTotalArs: number;
  revenueTotalRealArs: number | null;
  collectionRatePct: number | null;
  revenueAttributableArs: number;
  unclassifiedAmountArs: number;
  attributionPct: number;
  arpuArs: number;
  churnContractsPct: number;
  churnRevenuePct: number | null;
}

export interface FinanceOverviewResponse {
  months: FinanceOverviewMonth[];
  monthsWithoutSnapshot: string[];
  realSeriesMissingMonths: string[];
  inflationBaseYearMonth: string;
  metricBasis: 'cash_collected';
}

export interface FinanceCohortSurvivalPoint {
  survivingCount: number;
  pct: number;
}

export interface FinanceCohort {
  cohortYearMonth: string;
  originalCount: number;
  survival: {
    m3: FinanceCohortSurvivalPoint | null;
    m6: FinanceCohortSurvivalPoint | null;
    m12: FinanceCohortSurvivalPoint | null;
  };
}

export interface FinanceCohortsResponse {
  cohorts: FinanceCohort[];
  monthsWithoutCohortSnapshot: string[];
}

export interface FinanceCacAlta {
  contractId: string;
  clientId: string;
  customerName: string | null;
  mrrAtribuidoArs: number;
  attributionConfidence: AttributionConfidence;
  paybackMonths: number | null;
  lossMaking: boolean;
}

export interface FinanceCacResponse {
  technology: string;
  costConfigured: boolean;
  costIsZero: boolean;
  costoVentaArs: number | null;
  costoInstalacionArs: number | null;
  cacArs: number | null;
  altasDelMes: FinanceCacAlta[];
  altasDelMesSinTecnologia: number;
  maxPaybackMonths: number;
}

export interface FinanceVendorEarlyChurn {
  vendedor: string;
  altasTotal: number;
  altasChurneadasTemprano: number;
  altasMaduras: number;
  earlyChurnPct: number | null;
}

export interface FinanceVendorsEarlyChurnResponse {
  windowMonths: number;
  vendors: FinanceVendorEarlyChurn[];
}

export interface FinanceNodeGrowth {
  networkSiteId: string | null;
  networkSiteName: string | null;
  altas: number;
  bajas: number;
  netGrowth: number;
}

export interface FinanceNodesGrowthResponse {
  nodes: FinanceNodeGrowth[];
}

export interface FinanceMotivoBaja {
  motivo: string;
  bajas: number;
  mrrPerdidoArs: number;
  bajasSinPrecio: number;
}

export interface FinanceMotivosBajaResponse {
  motivos: FinanceMotivoBaja[];
}

export interface FinanceTechnologyCost {
  technologyName: string;
  costoVentaArs: number;
  costoInstalacionArs: number;
  costoMensualServicioArs: number;
  comisionVentaPct: number;
  updatedAt: string | null;
}

export interface FinanceTechnologyCostsResponse {
  technologies: FinanceTechnologyCost[];
}

export interface UpdateFinanceTechnologyCostPayload {
  costoVentaArs: number;
  costoInstalacionArs: number;
  costoMensualServicioArs: number;
  comisionVentaPct: number;
}

export interface FinancePlanPrice {
  planCode: string;
  planName: string;
  estimatedMonthlyPrice: number;
  updatedAt: string | null;
}

export interface FinancePlanPricesResponse {
  plans: FinancePlanPrice[];
}

export interface UpdateFinancePlanPricePayload {
  estimatedMonthlyPrice: number;
}

export interface FinanceTargetsConfig {
  churnTargetPct: number;
  maxPaybackMonths: number;
  monthlyNewContractsGoal: number;
  inflationBaseYearMonth: string;
}

export interface FinanceInflationEntry {
  yearMonth: string;
  monthlyRatePct: number;
  source: string | null;
}

export interface FinanceInflationResponse {
  index: FinanceInflationEntry[];
}

export interface UpdateFinanceInflationPayload {
  monthlyRatePct: number;
  source?: string;
}

export interface FinanceInvoiceType {
  grType: string;
  bucket: InvoiceTypeBucket;
  label: string | null;
  updatedAt: string;
}

export interface FinanceInvoiceTypesResponse {
  types: FinanceInvoiceType[];
}

export interface PatchFinanceInvoiceTypePayload {
  bucket: Exclude<InvoiceTypeBucket, 'unclassified'>;
  label?: string;
}

export interface FinanceSyncRunResponse {
  started: true;
}

export interface FinanceSyncStatusResponse {
  pacing: {
    requestIntervalMs: number;
    effectiveIntervalMs: number;
    degraded: boolean;
    consecutiveFailures: number;
    activeLane: 'delta' | 'reconcile' | 'backfill' | 'idle';
    /**
     * fix-wave-2 R3 (BE) — kill-switch operativo. `false` = el ingest de
     * recibos está APAGADO a propósito: NINGÚN carril avanza, "hoy" deja de
     * actualizarse aunque `degraded` sea `false` (`degraded` mide backoff por
     * fallas hacia GR, no el kill-switch). Faltaba en este tipo (regresión de
     * fix-wave-2 R3, fix-wave-5 FE 🔴3) — el JSON real ya lo traía, TypeScript
     * no lo detectaba porque un campo extra en la response es legal.
     */
    enabled: boolean;
  };
  delta: {
    lastRunAt: string | null;
    lastResult: string | null;
    itemsSynced: number;
    pendingPages: boolean;
    coveredThroughDate: string | null;
  };
  backfill: {
    lastRunAt: string | null;
    lastResult: string | null;
    itemsSynced: number;
    cursorYearMonth: string | null;
    cursorPageOffset: number;
    done: boolean;
  };
  /**
   * gr-receipt-annulment (BE, en prod desde 2026-08-10) — tercer carril:
   * barrido de anulaciones de recibos. Calco EXACTO de
   * `application/dto/financeGrowth.dto.ts:87-95`. Campos REQUERIDOS (el BE
   * ya los emite siempre); las LECTURAS en el componente son defensivas con
   * `?.` para tolerar un deploy escalonado (design.md §6 Decisión 6) — el
   * tipo describe el contrato real, el `?.` describe la ventana de deploy.
   */
  reconcile: {
    lastRunAt: string | null;
    lastResult: string | null;
    itemsSynced: number;
    sweepInProgress: boolean;
    windowFrom: string | null;
    windowTo: string | null;
    pageOffset: number;
  };
  debtorBalances: { lastRunAt: string | null; lastResult: string | null; itemsSynced: number };
  snapshotJob: { lastRunAt: string | null; lastResult: string | null; itemsSynced: number };
}
