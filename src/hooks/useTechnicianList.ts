import { useQuery } from '@tanstack/react-query';
import { getTechnicianList } from '@/api/technicianList.api';

export const TECHNICIAN_LIST_QUERY_KEY = ['inventory', 'technicians', 'list'] as const;

/**
 * Fetches the full technician list with stock summary (name, assetCount,
 * materialQty). Sorted by name from the API. Used by the InventoryTechniciansPage
 * list introduced in W5b.
 */
export function useTechnicianList() {
  return useQuery({
    queryKey: TECHNICIAN_LIST_QUERY_KEY,
    queryFn: getTechnicianList,
    staleTime: 60_000,
  });
}
