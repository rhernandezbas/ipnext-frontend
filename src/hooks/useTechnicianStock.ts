import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTechnicianStock, issueStockToTechnician } from '@/api/technician.api';
import { DEPOT_STOCK_QUERY_KEY } from '@/hooks/useDepotStock';
import type { IssueStockPayload } from '@/types/technician';

/** Per-technician query key. Scoped by id so two technicians don't share a cache entry. */
export const TECHNICIAN_STOCK_QUERY_KEY = (technicianId: string) =>
  ['inventory', 'technician', technicianId, 'stock'] as const;

/**
 * Read-only technician stock (EPIC #38, Wave 5a). Mirrors `useDepotStock`.
 *
 * The backend returns the empty shape (`{ assets: [], materials: [],
 * locationId: null }`) instead of a 404 when the technician has no TECNICO row,
 * so the happy path already covers the empty technician — the primary case in
 * production today.
 */
export function useTechnicianStock(technicianId: string) {
  return useQuery({
    queryKey: TECHNICIAN_STOCK_QUERY_KEY(technicianId),
    queryFn: () => getTechnicianStock(technicianId),
    staleTime: 30_000,
  });
}

/**
 * Issue (assign) stock from the depot to a technician.
 *
 * On success it invalidates BOTH the technician's stock (the items just landed
 * there) and the depot stock (they just left it), keeping both views truthful
 * without a manual refetch.
 */
export function useIssueStock(technicianId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueStockPayload) =>
      issueStockToTechnician(technicianId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TECHNICIAN_STOCK_QUERY_KEY(technicianId) });
      qc.invalidateQueries({ queryKey: DEPOT_STOCK_QUERY_KEY });
    },
  });
}
