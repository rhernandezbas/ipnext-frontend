import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceCatalogApi } from '@/api/service-catalog.api';
import type { CreateServiceCatalogPayload, PatchServiceCatalogPayload } from '@/api/service-catalog.api';

/** Prefix key — mutations invalidate this so both the full list and the
 *  `['service-catalog','active']` variant refetch. */
const KEY = ['service-catalog'] as const;

export function useServiceCatalog(activeOnly = false) {
  return useQuery({
    queryKey: activeOnly ? ([...KEY, 'active'] as const) : KEY,
    queryFn: () => serviceCatalogApi.list(activeOnly),
    staleTime: 60_000,
  });
}

export function useCreateServiceCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceCatalogPayload) => serviceCatalogApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateServiceCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatchServiceCatalogPayload }) =>
      serviceCatalogApi.patch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteServiceCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceCatalogApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
