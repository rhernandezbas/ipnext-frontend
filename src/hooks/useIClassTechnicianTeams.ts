import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iclassTechnicianTeamsApi } from '@/api/iclassTechnicianTeams.api';

const KEY = ['iclass-technician-teams'] as const;

/**
 * Lista los técnicos con su cuadrilla IClass mapeada (o null si sin mapeo).
 * Gate: iclass.read
 */
export function useIClassTechnicianTeams() {
  return useQuery({
    queryKey: KEY,
    queryFn: iclassTechnicianTeamsApi.list,
    staleTime: 60_000,
  });
}

/**
 * Cambia (o borra con null) el mapeo técnico → cuadrilla.
 * Gate: iclass.manage
 */
export function useSetTechnicianTeamMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, iclassTeamLogin }: { userId: string; iclassTeamLogin: string | null }) =>
      iclassTechnicianTeamsApi.setMapping(userId, iclassTeamLogin),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
