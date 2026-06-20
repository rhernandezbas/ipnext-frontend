import { useQuery } from '@tanstack/react-query';
import { getMyPortfolio } from '@/api/portfolio.api';

export const MY_PORTFOLIO_QUERY_KEY = ['portfolio', 'mine'] as const;

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
