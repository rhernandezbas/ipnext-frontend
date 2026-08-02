import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promosApi } from '@/api/promos.api';
import type { CreatePromoInput, UpdatePromoInput } from '@/api/promos.api';
import type { CampaignSegment } from '@/types/messagingBulk';

export const promosKey = ['promos'] as const;

/** Mensaje claro por status — mismo criterio que `toServerError` de `useTemplatesAdmin.ts`. */
function toServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: string } | undefined;
    if (status === 400) return body?.error ?? 'Datos inválidos: revisá los campos obligatorios y las fechas de vigencia.';
    if (status === 404) return body?.error ?? 'La promoción ya no existe (quizás se borró/archivó desde otra sesión).';
  }
  return 'No se pudo guardar la promoción. Reintentá en unos segundos.';
}

export function usePromos() {
  return useQuery({ queryKey: promosKey, queryFn: promosApi.list, staleTime: 30_000 });
}

export function useCreatePromo() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: CreatePromoInput) => promosApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: promosKey }),
  });
  return {
    create: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

export function useUpdatePromo() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePromoInput }) => promosApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: promosKey }),
  });
  return {
    update: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

/**
 * Preview de audiencia — mutation (no query) porque se dispara con debounce
 * al cambiar el segmento (mismo criterio que `usePreviewSegment` de Bulk
 * Messaging), no atado a un `queryKey` estable.
 */
export function useAudiencePreview() {
  const mutation = useMutation({
    mutationFn: (segment: CampaignSegment) => promosApi.audiencePreview(segment),
  });
  return {
    preview: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
