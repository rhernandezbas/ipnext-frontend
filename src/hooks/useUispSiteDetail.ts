import { useQuery } from '@tanstack/react-query';
import { fetchUispSiteDetail } from '@/api/uisp.api';

export const uispSiteDetailKey = (uispId: string) => ['uisp', 'sites', uispId] as const;

/** Fetches a single UISP site detail + its devices. Requires uisp.read permission. */
export function useUispSiteDetail(uispId: string) {
  return useQuery({
    queryKey: uispSiteDetailKey(uispId),
    queryFn: () => fetchUispSiteDetail(uispId),
    staleTime: 30_000,
    retry: false,
    enabled: !!uispId,
  });
}
