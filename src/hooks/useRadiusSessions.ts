import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as api from '@/api/radius.api';
import type { RadiusSessionsParams } from '@/types/radiusSessions';

/**
 * Legacy: sin params → array puro RadiusSession[].
 * Preserva consumidores existentes del contrato array.
 */
export function useRadiusSessions() {
  return useQuery({ queryKey: ['radius-sessions'], queryFn: api.getRadiusSessions });
}

/**
 * Paginado: siempre manda page+limit → siempre recibe PaginatedRadiusSessions.
 * Los params forman parte del queryKey → cada combinación tiene su caché.
 */
export function useRadiusSessionsPaginated(params: RadiusSessionsParams) {
  return useQuery({
    queryKey: ['radius-sessions-paginated', params],
    queryFn: () => api.getRadiusSessionsPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.disconnectSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radius-sessions'] }),
  });
}
