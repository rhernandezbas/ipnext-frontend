import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iclassStatusCatalogApi } from '@/api/iclassStatusCatalog.api';
import type { UpdateIClassStatusCatalogPayload } from '@/types/iclassStatusCatalog';

const KEY = ['iclassStatusCatalog'] as const;

/** Lista el catálogo configurable de estados de IClass. */
export function useIClassStatusCatalog() {
  return useQuery({
    queryKey: KEY,
    queryFn: iclassStatusCatalogApi.list,
    staleTime: 60_000,
  });
}

/** Dispara el discovery/sync de estados desde IClass e invalida el catálogo. */
export function useSyncIClassStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: iclassStatusCatalogApi.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Edita un estado del catálogo (displayLabel, color, tracked) e invalida. */
export function useUpdateIClassStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ statusCode, payload }: { statusCode: string; payload: UpdateIClassStatusCatalogPayload }) =>
      iclassStatusCatalogApi.update(statusCode, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
