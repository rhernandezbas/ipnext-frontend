import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NetworkSite, NetworkSiteCreate } from '@/types/networkSite';
import * as api from '@/api/networkSite.api';

/**
 * `staleTime` opcional (node-segment-fe) — los consumidores de CATÁLOGO (los
 * selects de nodo del bulk composer) no necesitan refetch agresivo; los de
 * gestión (NetworkSitesPage) siguen con el default (0) sin cambio.
 */
export function useNetworkSites(options: { staleTime?: number } = {}) {
  return useQuery({
    queryKey: ['network-sites'],
    queryFn: api.getNetworkSites,
    staleTime: options.staleTime,
  });
}

export function useCreateNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NetworkSiteCreate) => api.createNetworkSite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-sites'] }),
  });
}

export function useUpdateNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkSite> }) =>
      api.updateNetworkSite(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-sites'] }),
  });
}

export function usePatchNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkSite> }) =>
      api.patchNetworkSite(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-sites'] }),
  });
}

export function useDeleteNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNetworkSite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-sites'] }),
  });
}
