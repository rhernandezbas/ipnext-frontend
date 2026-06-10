import { useQuery } from '@tanstack/react-query';
import { fetchUispSites } from '@/api/uisp.api';

export const UISP_SITES_KEY = ['uisp', 'sites'] as const;

/** Fetches all UISP mirror sites. Requires uisp.read permission. */
export function useUispSites() {
  return useQuery({
    queryKey: UISP_SITES_KEY,
    queryFn: fetchUispSites,
    staleTime: 30_000,
    retry: false,
  });
}
