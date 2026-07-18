import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/cannedResponses.api';
import type {
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from '@/types/cannedResponses';

/**
 * useCannedResponses (Ola 4 — respuestas rápidas / macros) — hooks del catálogo
 * de respuestas rápidas en un solo archivo (convención del repo, molde
 * `useTemplatesAdmin.ts`).
 *
 * La LISTA es un CATÁLOGO: `staleTime` alto (cambia poco, se administra a mano)
 * y `enabled` lo ata el caller — el picker del composer lo pone en `true` recién
 * al abrir el popover (design Ola 4: "NO fetchear hasta abrir el popover"). El
 * filtro del picker es CLIENT-SIDE sobre esta lista completa (no un `?q=`
 * server-side por tecla) — coherente con un catálogo cacheado. El `?q=` del
 * contrato queda disponible en la api para búsquedas server-side futuras.
 */

export const cannedResponsesKey = ['cannedResponses'] as const;

/** Catálogo completo. `enabled` lo ata el caller (picker: abierto; gestión: permiso `messaging.manage`). */
export function useCannedResponses(enabled: boolean = true) {
  return useQuery({
    queryKey: cannedResponsesKey,
    queryFn: () => api.listCannedResponses(),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Mensaje claro para los errores de crear/editar una respuesta rápida. Mapea por
 * CODE (contrato estable del BE), con el `error` del body como override. Mismo
 * criterio que `toServerError` de `useTemplatesAdmin`.
 */
function toServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: string; code?: string } | undefined;
    if (body?.code === 'SHORTCUT_TAKEN' || status === 409) {
      return 'Ese atajo ya está en uso. Elegí otro.';
    }
    if (body?.code === 'VALIDATION_ERROR' || status === 400) {
      return body?.error ?? 'Datos inválidos: el atajo y el contenido no pueden estar vacíos.';
    }
    if (body?.code === 'CANNED_RESPONSE_NOT_FOUND' || status === 404) {
      return 'La respuesta rápida ya no existe (quizás se borró desde otra sesión).';
    }
  }
  return 'No se pudo completar la acción. Reintentá en unos segundos.';
}

function invalidateList(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: cannedResponsesKey });
}

/** CREATE — invalida la lista al crear. 409/400 se exponen como `serverError` (string) para el form. */
export function useCreateCannedResponse() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateCannedResponseInput) => api.createCannedResponse(input),
    onSuccess: () => invalidateList(qc),
  });

  return {
    create: mutation.mutate,
    createAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

/** UPDATE (PUT /:id) — invalida la lista al editar. Mismo mapeo de error que create. */
export function useUpdateCannedResponse() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCannedResponseInput }) =>
      api.updateCannedResponse(id, input),
    onSuccess: () => invalidateList(qc),
  });

  return {
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

/** DELETE (DELETE /:id) — invalida la lista al resolver. */
export function useDeleteCannedResponse() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => api.deleteCannedResponse(id),
    onSuccess: () => invalidateList(qc),
  });

  return {
    remove: mutation.mutate,
    removeAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}
