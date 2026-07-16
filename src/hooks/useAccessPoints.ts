import { useQuery } from '@tanstack/react-query';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';

/**
 * contract-node-ap-auto-assign (Fase B, picker manual) — catálogo de APs asignables, opcionalmente
 * acotado a un nodo (`networkSiteId`). `null`/`undefined` piden el catálogo completo.
 *
 * `enabled` (node-segment-fe fix wave, M2) — `GET /api/access-points` exige `network.read`:
 * el caller lo ata al permiso (mismo patrón que `useTemplates(enabled)`) para no disparar un
 * 403 seguro. Default `true` — cero cambio para el picker de contrato y demás callers.
 */
export function useAssignableAccessPoints(networkSiteId?: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['access-points', networkSiteId ?? 'all'],
    queryFn: () => listAssignableAccessPoints(networkSiteId ?? undefined),
    staleTime: 30_000,
    enabled,
  });
}
