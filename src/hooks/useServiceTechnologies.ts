import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceTechnologiesApi } from '@/api/serviceTechnologies.api';

const KEY = ['service-technologies'] as const;

export function useServiceTechnologies() {
  return useQuery({
    queryKey: KEY,
    queryFn: serviceTechnologiesApi.list,
    staleTime: 60_000,
  });
}

export function useCreateServiceTechnology() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: serviceTechnologiesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateServiceTechnology() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string | null } }) =>
      serviceTechnologiesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteServiceTechnology() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceTechnologiesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
