import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialTypesApi } from '@/api/materialTypes.api';

const KEY = ['material-types'] as const;

export function useMaterialTypes() {
  return useQuery({ queryKey: KEY, queryFn: materialTypesApi.list, staleTime: 60_000 });
}

export function useCreateMaterialType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: materialTypesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMaterialType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; label?: string | null; unit?: string | null; active?: boolean; sortOrder?: number } }) =>
      materialTypesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMaterialType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => materialTypesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
