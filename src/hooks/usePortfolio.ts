import { useQuery } from '@tanstack/react-query';
import { getMyPortfolio, getPortfolioByVendedor, getAllPortfolios } from '@/api/portfolio.api';

export const MY_PORTFOLIO_QUERY_KEY = ['portfolio', 'mine'] as const;

/** Query key for a single vendedor's portfolio (super admin view). */
export const portfolioByVendedorQueryKey = (vendedor: string) =>
  ['portfolio', 'by-vendedor', vendedor] as const;

/** Query key for the all-agents portfolio (super admin view). */
export const ALL_PORTFOLIOS_QUERY_KEY = ['portfolio', 'all'] as const;

/**
 * Loads the logged-in agent's portfolio ("Mis clientes").
 *
 * Stale for 60s — the portfolio composition (clients per vendedor) changes
 * slowly; status/debt/claims are read-only views the agent refreshes on demand.
 */
export function useMyPortfolio() {
  return useQuery({
    queryKey: MY_PORTFOLIO_QUERY_KEY,
    queryFn: getMyPortfolio,
    staleTime: 60_000,
  });
}

/**
 * Loads a single vendedor's portfolio (super admin view, gate recapture.manage).
 *
 * `enabled` lets the caller hold the request until a vendedor is selected AND
 * the admin gate is satisfied — never fire this for a non-admin agent. The
 * query stays disabled while `vendedor` is empty regardless of `enabled`.
 */
export function usePortfolioByVendedor(vendedor: string, enabled = true) {
  return useQuery({
    queryKey: portfolioByVendedorQueryKey(vendedor),
    queryFn: () => getPortfolioByVendedor(vendedor),
    staleTime: 60_000,
    enabled: enabled && vendedor.trim().length > 0,
  });
}

/**
 * Loads every agent's portfolio (super admin view, gate recapture.manage).
 *
 * `enabled` guards the request so it only fires for the "Todos los agentes"
 * mode under an admin — never for a plain agent or another mode.
 */
export function useAllPortfolios(enabled = true) {
  return useQuery({
    queryKey: ALL_PORTFOLIOS_QUERY_KEY,
    queryFn: getAllPortfolios,
    staleTime: 60_000,
    enabled,
  });
}
