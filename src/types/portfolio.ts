/**
 * Portfolio types — "Mis clientes" (Fase 4).
 *
 * Mirrors the backend output contract for `GET /api/portfolio/mine`
 * (src/application/dto/portfolio/portfolio.dto.ts). Keep these in sync with the
 * BE DTO — the FE consumes the shape verbatim, no remapping on the wire.
 */

/** Client age in the agent's portfolio, bucketed by oldest contract start date. */
export type AgeBucket = '0-3' | '3-6' | '6-12' | '12+';

/** Ordered bucket sequence used to render sections in a stable, readable order. */
export const AGE_BUCKETS: readonly AgeBucket[] = ['0-3', '3-6', '6-12', '12+'] as const;

/** Human-readable labels for each age bucket. */
export const AGE_BUCKET_LABELS: Record<AgeBucket, string> = {
  '0-3': '0 a 3 meses',
  '3-6': '3 a 6 meses',
  '6-12': '6 a 12 meses',
  '12+': 'Más de 12 meses',
};

/** A single client in the logged-in agent's portfolio. */
export interface PortfolioItem {
  clientId: string;
  clientName: string;
  /** GR client status vocabulary: active | late | blocked | inactive | baja. */
  status: string;
  ageBucket: AgeBucket;
  /** ISO date of the oldest contract this agent's vendedor sold to the client. */
  oldestStartDate: string;
  contractsCount: number;
  hasDebt: boolean;
  debtAmount: number | null;
  debtCurrency: string | null;
  openClaims: number;
}

/** Aggregated counters for the summary cards. */
export interface PortfolioSummary {
  total: number;
  byBucket: Record<AgeBucket, number>;
  active: number;
  withDebt: number;
  withClaims: number;
}

/** Full payload returned by GET /api/portfolio/mine. */
export interface Portfolio {
  items: PortfolioItem[];
  summary: PortfolioSummary;
  /** True when the agent has no GR vendedor mapping → no portfolio to show. */
  unmapped: boolean;
}
