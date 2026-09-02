import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getExternalBulkMessagingConfig,
  updateExternalBulkMessagingConfig,
} from '@/api/externalBulkMessagingConfig.api';
import type {
  ExternalBulkMessagingConfig,
  UpdateExternalBulkMessagingConfigPayload,
} from '@/types/externalBulkMessaging';

/**
 * useExternalBulkMessagingConfig (external-bulk-messaging FE, D13) — hooks de
 * los topes (`maxPerRequest`/`maxPerDay`) del envío masivo externo. Molde
 * `useFeatureFlags.ts` (par GET query + mutation con invalidación).
 *
 * Único consumidor hoy: `ExternalBulkMessagingCard` (Ajustes → WhatsApp, gate
 * `messaging.read`/`.manage`).
 */
export const externalBulkMessagingConfigKey = ['externalBulkMessagingConfig'] as const;

export function useExternalBulkMessagingConfig() {
  return useQuery<ExternalBulkMessagingConfig>({
    queryKey: externalBulkMessagingConfigKey,
    queryFn: getExternalBulkMessagingConfig,
    staleTime: 60_000,
  });
}

/**
 * PUT replace. `onSuccess` escribe la respuesta directo en la cache vía
 * `setQueryData` — SINCRÓNICO con la resolución del PUT, sin esperar ningún
 * refetch (fix wave 2, item 1: evita la ventana ciega donde `config` seguía
 * con el valor viejo justo después de guardar y el form quedaba "dirty" de
 * más). Además, en `onSettled` invalida la query para consistencia eventual
 * con el servidor — corre tanto en éxito como en error.
 */
export function useSetExternalBulkMessagingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateExternalBulkMessagingConfigPayload) =>
      updateExternalBulkMessagingConfig(payload),
    onSuccess: (response) => {
      qc.setQueryData(externalBulkMessagingConfigKey, response);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: externalBulkMessagingConfigKey });
    },
  });
}
