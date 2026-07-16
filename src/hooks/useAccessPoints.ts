import { useQuery } from '@tanstack/react-query';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';

/**
 * contract-node-ap-auto-assign (Fase B, picker manual) — catálogo de APs asignables, opcionalmente
 * acotado a un nodo (`networkSiteId`). `null`/`undefined` piden el catálogo completo.
 */
export function useAssignableAccessPoints(networkSiteId?: string | null) {
  return useQuery({
    queryKey: ['access-points', networkSiteId ?? 'all'],
    queryFn: () => listAssignableAccessPoints(networkSiteId ?? undefined),
    staleTime: 30_000,
  });
}
