import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iclassTeamsApi } from '@/api/iclassTeams.api';

const KEY = ['iclass-teams'] as const;

/**
 * Catálogo de cuadrillas IClass. Incluye activas e inactivas; los componentes
 * filtran por `active && selectable` para el selector operativo.
 */
export function useIClassTeams() {
  return useQuery({
    queryKey: KEY,
    queryFn: iclassTeamsApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useSyncIClassTeams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: iclassTeamsApi.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
