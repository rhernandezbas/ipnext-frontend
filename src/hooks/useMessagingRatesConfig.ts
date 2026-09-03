import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMessagingCreditBalance,
  getMessagingRatesConfig,
  updateMessagingRatesConfig,
} from '@/api/messagingRatesConfig.api';
import type { MessagingRatesConfig, UpdateMessagingRatesConfigPayload } from '@/types/messagingRates';

/**
 * useMessagingRatesConfig (twilio-credit-guard FE, D8) — hooks de las 5
 * tarifas (`currency`/`utilityRate`/`marketingRate`/`authenticationRate`/
 * `providerFee`) y del saldo Twilio. Molde `useExternalBulkMessagingConfig.ts`
 * (par GET query + mutation con `setQueryData` sincrónico en éxito +
 * invalidate en `onSettled`).
 *
 * Único consumidor hoy: `MessagingRatesCard` (Ajustes → WhatsApp, gate
 * `messaging.read`/`.manage`).
 */
export const messagingRatesConfigKey = ['messagingRatesConfig'] as const;
export const messagingCreditBalanceKey = ['messagingCreditBalance'] as const;

export function useMessagingRatesConfig() {
  return useQuery<MessagingRatesConfig>({
    queryKey: messagingRatesConfigKey,
    queryFn: getMessagingRatesConfig,
    staleTime: 60_000,
  });
}

/**
 * PUT replace. `onSuccess` escribe la respuesta directo en la cache vía
 * `setQueryData` — SINCRÓNICO con la resolución del PUT, sin esperar ningún
 * refetch (mismo fix wave 2 item 1 de `useExternalBulkMessagingConfig`).
 * `onSettled` invalida para consistencia eventual, en éxito y en error.
 */
export function useSetMessagingRatesConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMessagingRatesConfigPayload) => updateMessagingRatesConfig(payload),
    onSuccess: (response) => {
      qc.setQueryData(messagingRatesConfigKey, response);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: messagingRatesConfigKey });
    },
  });
}

/**
 * Saldo Twilio — query INDEPENDIENTE de la de tarifas (2 fetch al mismo
 * padre, D5.c). Sin `staleTime`: el botón "Actualizar" de la card llama
 * `refetch()` explícito: un `staleTime` alto haría que ese refetch pareciera
 * no-op si el usuario vuelve a pedirlo enseguida.
 */
export function useMessagingCreditBalance() {
  return useQuery({
    queryKey: messagingCreditBalanceKey,
    queryFn: getMessagingCreditBalance,
    retry: false,
  });
}
