import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CpeDevice } from '@/types/cpe';
import * as api from '@/api/cpe.api';

export function useCpeDevices() {
  return useQuery({ queryKey: ['cpe-devices'], queryFn: api.getCpeDevices });
}

export function useCreateCpeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CpeDevice, 'id'>) => api.createCpeDevice(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cpe-devices'] }),
  });
}

export function useAssignCpeToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId, clientName }: { id: string; clientId: string; clientName: string }) =>
      api.assignCpeToClient(id, clientId, clientName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cpe-devices'] }),
  });
}

export function useDeleteCpeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCpeDevice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cpe-devices'] }),
  });
}
