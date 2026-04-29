import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { HardwareAsset } from '@/types/hardware';
import * as api from '@/api/hardware.api';

export function useHardwareAssets() {
  return useQuery({ queryKey: ['hardware-assets'], queryFn: api.getHardwareAssets });
}

export function useCreateHardwareAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<HardwareAsset, 'id'>) => api.createHardwareAsset(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hardware-assets'] }),
  });
}

export function useUpdateHardwareAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HardwareAsset> }) =>
      api.updateHardwareAsset(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hardware-assets'] }),
  });
}

export function useDeleteHardwareAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHardwareAsset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hardware-assets'] }),
  });
}
