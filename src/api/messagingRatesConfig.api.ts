import axiosClient from './axios-client';
import type {
  MessagingCreditBalance,
  MessagingRatesConfig,
  UpdateMessagingRatesConfigPayload,
} from '@/types/messagingRates';

/**
 * messagingRatesConfig.api (twilio-credit-guard FE, D8) — cliente del router
 * `/api/messaging/config/rates` (`messaging-rates-config.routes.ts`, molde
 * EXACTO `externalBulkMessagingConfig.routes.ts`).
 *
 * Envelope FLAT en las 3 llamadas (`res.json({...})` directo, sin `{data}` de
 * por medio — mismo criterio que `externalBulkMessagingConfig.api.ts`).
 */
const BASE = '/messaging/config/rates';

export const getMessagingRatesConfig = (): Promise<MessagingRatesConfig> =>
  axiosClient.get<MessagingRatesConfig>(BASE).then((r) => r.data);

export const updateMessagingRatesConfig = (
  payload: UpdateMessagingRatesConfigPayload,
): Promise<MessagingRatesConfig> =>
  axiosClient.put<MessagingRatesConfig>(BASE, payload).then((r) => r.data);

export const getMessagingCreditBalance = (): Promise<MessagingCreditBalance> =>
  axiosClient.get<MessagingCreditBalance>(`${BASE}/balance`).then((r) => r.data);
