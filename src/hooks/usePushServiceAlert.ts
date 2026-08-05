import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { pushApi } from '@/api/push.api';
import type { PushServiceAlertScopeInput, SendPushServiceAlertInput } from '@/api/push.api';

/** Mensaje claro por status — mismo criterio que `toServerError` de `usePromos.ts`. */
function toServerError(error: unknown, fallback: string): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: string } | undefined;
    if (status === 400) return body?.error ?? 'Datos inválidos: revisá el título y el mensaje.';
    if (status === 403) return 'No tenés permiso para enviar avisos push (`push.send`).';
  }
  return fallback;
}

/**
 * Preview del alcance — mutation, no query: se dispara con un botón explícito
 * ("Ver alcance"), no al montar. Que el operador tenga que pedirlo es parte
 * del diseño: el número que va a leer en la confirmación es el que ÉL pidió
 * para ESTE filtro, no uno que quedó de un render anterior.
 */
export function usePushServiceAlertPreview() {
  const mutation = useMutation({
    mutationFn: (input: PushServiceAlertScopeInput) => pushApi.previewServiceAlert(input),
  });
  return {
    preview: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    reset: mutation.reset,
    serverError: toServerError(mutation.error, 'No se pudo calcular el alcance. Reintentá en unos segundos.'),
  };
}

/**
 * Envío real. `sendAsync` (no `mutate`) porque el llamador encadena el
 * resultado después de la doble confirmación — necesita await, no callback.
 */
export function useSendPushServiceAlert() {
  const mutation = useMutation({
    mutationFn: (input: SendPushServiceAlertInput) => pushApi.sendServiceAlert(input),
  });
  return {
    sendAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    reset: mutation.reset,
    serverError: toServerError(mutation.error, 'No se pudo enviar el aviso. Reintentá en unos segundos.'),
  };
}
