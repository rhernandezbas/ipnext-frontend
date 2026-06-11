import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIClassNodes, syncIClassNodes } from '@/api/iclassNodes.api';

const KEY = ['iclass-nodes'] as const;

/**
 * Full IClass node catalog (incl. inactive / non-selectable) for the mapping table.
 * M1: a site's `iclassNodeCode` that matches a now-inactive node must render as
 * "(inactivo en IClass)" rather than the misleading "(sin validar)" — that needs the
 * full catalog. Eligibility for the dropdown (active && selectable) is filtered in the
 * component, not at the fetch.
 */
export function useIClassNodes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => getIClassNodes(),
    staleTime: 60_000,
  });
}

export function useSyncIClassNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncIClassNodes,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
