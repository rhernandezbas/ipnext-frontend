import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { iclassClosureApi } from '@/api/iclassClosure.api';
import type { ClosureConfig } from '@/api/iclassClosure.api';

const QUERY_KEY = ['iclassClosure', 'config'] as const;

/** Fetches GET /closure/config — { closureIntervalMs, autocompleteIntervalMs }. */
export function useClosureConfig() {
  return useQuery<ClosureConfig>({
    queryKey: QUERY_KEY,
    queryFn: iclassClosureApi.getConfig,
  });
}

/** Mutation for PUT /closure/config. Invalidates the config query on success. */
export function useUpdateClosureConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ClosureConfig>) => iclassClosureApi.updateConfig(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
