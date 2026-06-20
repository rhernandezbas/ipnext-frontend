import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { IpNetwork, IpPool, Ipv6Network } from '@/types/network';
import * as api from '@/api/network.api';
import type { GetIpAssignmentsParams } from '@/api/network.api';

export function useIpNetworks() {
  return useQuery({ queryKey: ['ip-networks'], queryFn: api.getIpNetworks });
}

export function useCreateIpNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<IpNetwork, 'id'>) => api.createIpNetwork(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-networks'] }),
  });
}

export function useDeleteIpNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteIpNetwork(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-networks'] }),
  });
}

export function useIpPools() {
  return useQuery({ queryKey: ['ip-pools'], queryFn: api.getIpPools });
}

export function useCreateIpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<IpPool, 'id'>) => api.createIpPool(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-pools'] }),
  });
}

export function useDeleteIpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteIpPool(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-pools'] }),
  });
}

export function useIpAssignments(params: GetIpAssignmentsParams) {
  return useQuery({
    queryKey: ['ip-assignments', params],
    queryFn: () => api.getIpAssignments(params),
    placeholderData: keepPreviousData,
  });
}

export function useIpv6Networks() {
  return useQuery({ queryKey: ['ipv6-networks'], queryFn: api.getIpv6Networks });
}

export function useCreateIpv6Network() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Ipv6Network, 'id'>) => api.createIpv6Network(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ipv6-networks'] }),
  });
}
