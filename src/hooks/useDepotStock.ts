import { useQuery } from '@tanstack/react-query';
import { getDepotStock } from '@/api/depot.api';

export const DEPOT_STOCK_QUERY_KEY = ['inventory', 'depot'] as const;

/**
 * Read-only depot stock (EPIC #38, Wave 3). Wraps `getDepotStock()`.
 *
 * The backend returns the empty shape (`{ assets: [], materials: [],
 * depotLocationId: null }`) rather than a 404 when no DEPOSITO row exists, so
 * the happy path already covers the empty depot. `staleTime` is generous: this
 * is low-churn, read-only data.
 */
export function useDepotStock() {
  return useQuery({
    queryKey: DEPOT_STOCK_QUERY_KEY,
    queryFn: getDepotStock,
    staleTime: 30_000,
  });
}
