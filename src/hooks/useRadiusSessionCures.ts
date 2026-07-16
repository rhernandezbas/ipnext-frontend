import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRadiusSessionCures,
  postRadiusSessionCure,
} from '@/api/networkAudit.api';
import type { RadiusSessionCuresParams } from '@/api/networkAudit.api';
import type { CureSessionBody, CureSessionResult } from '@/types/radiusSessionCure';

/** Query key raíz — compartida por la query de lectura y la invalidación post-cura. */
export const RADIUS_SESSION_CURES_KEY = ['radius-session-cures'] as const;

/**
 * Tab "Sesiones curadas" (radius-session-autocure FE-1, REQ-FE-CURE-1). Lista
 * paginada server-side de RadiusSessionCureEvent. Endpoint gated `network.read`
 * en el BE (alineado a los tabs vecinos de la page de auditoría).
 */
export function useRadiusSessionCures(params: RadiusSessionCuresParams) {
  return useQuery({
    queryKey: [...RADIUS_SESSION_CURES_KEY, params],
    queryFn: () => getRadiusSessionCures(params),
  });
}

/**
 * Cura manual (escape hatch, REQ-FE-CURE-2) — botón "Curar sesión colgada" en las
 * filas `session_stuck` de "Errores de auth". Gated `network.manage` en el BE.
 *
 * `onSettled` (no `onSuccess`): el BE registra fila SIEMPRE, incluso en los 409
 * fail-closed (alive/ambiguous) — el tab "Sesiones curadas" debe refrescar tanto en
 * éxito como en un intento rechazado por el gate, para que la fila nueva sea visible.
 */
export function useCureSession() {
  const queryClient = useQueryClient();
  return useMutation<CureSessionResult, unknown, CureSessionBody>({
    mutationFn: (body) => postRadiusSessionCure(body),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: RADIUS_SESSION_CURES_KEY });
    },
  });
}
