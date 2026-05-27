import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NetworkDevice } from '@/types/network-devices';
import * as api from '@/api/network-devices.api';

export function useNetworkDevices() {
  return useQuery({ queryKey: ['network-devices'], queryFn: api.getNetworkDevices });
}

export function useCreateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createNetworkDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}

export function useUpdateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkDevice> }) =>
      api.updateNetworkDevice(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}
