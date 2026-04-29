import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NetworkSite } from '@/types/networkSite';
import * as api from '@/api/networkSite.api';

export function useNetworkSites() {
  return useQuery({ queryKey: ['network-sites'], queryFn: api.getNetworkSites });
}

export function useCreateNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NetworkSite, 'id'>) => api.createNetworkSite(data),
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

export function useDeleteNetworkSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNetworkSite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-sites'] }),
  });
}
