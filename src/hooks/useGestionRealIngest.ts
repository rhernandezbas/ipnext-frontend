import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gestionRealIngestApi } from '@/api/gestionRealIngest.api';
import type { UpdateIngestConfigPayload } from '@/types/gestionRealIngest';

const ROOT = ['gestionRealIngest'] as const;
const CONFIG_KEY = [...ROOT, 'config'] as const;
const STATUS_KEY = [...ROOT, 'status'] as const;
const NEEDS_REVIEW_KEY = [...ROOT, 'needsReview'] as const;

export function useGestionRealConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: gestionRealIngestApi.getConfig,
  });
}

export function useUpdateGestionRealConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateIngestConfigPayload) => gestionRealIngestApi.updateConfig(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONFIG_KEY });
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

export function useGestionRealStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: gestionRealIngestApi.getStatus,
    refetchInterval: 30_000,
  });
}

export function useGestionRealNeedsReview() {
  return useQuery({
    queryKey: NEEDS_REVIEW_KEY,
    queryFn: gestionRealIngestApi.getNeedsReview,
  });
}
