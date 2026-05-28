import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iclassSoTypesApi } from '@/api/iclassSoTypes.api';

const KEY = ['iclassSoTypes'] as const;

export function useIClassSoTypes(active?: boolean) {
  return useQuery({
    queryKey: [...KEY, active ?? 'all'],
    queryFn: () => iclassSoTypesApi.list(active),
    staleTime: 60_000,
  });
}

export function useSyncIClassSoTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: iclassSoTypesApi.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
