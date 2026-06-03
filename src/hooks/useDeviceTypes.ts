import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceTypesApi } from '@/api/deviceTypes.api';

const KEY = ['device-types'] as const;

export function useDeviceTypes() {
  return useQuery({ queryKey: KEY, queryFn: deviceTypesApi.list, staleTime: 60_000 });
}

export function useCreateDeviceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deviceTypesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDeviceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; label?: string | null; active?: boolean; sortOrder?: number } }) =>
      deviceTypesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDeviceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deviceTypesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
