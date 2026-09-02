import axiosClient from './axios-client';
import type {
  ExternalBulkMessagingConfig,
  UpdateExternalBulkMessagingConfigPayload,
} from '@/types/externalBulkMessaging';

/**
 * externalBulkMessagingConfig.api (external-bulk-messaging FE, D12/D13) —
 * cliente del router `/api/messaging/config/external-bulk`
 * (`externalBulkMessagingConfig.routes.ts`, molde EXACTO `taskStageConfig.routes.ts`).
 *
 * Envelope FLAT en ambos verbos (`res.json({maxPerRequest, maxPerDay,
 * updatedAt})` directo, sin `{data}` de por medio — mismo criterio que
 * `taskStageConfig.api.ts`).
 */
const BASE = '/messaging/config/external-bulk';

export const getExternalBulkMessagingConfig = (): Promise<ExternalBulkMessagingConfig> =>
  axiosClient.get<ExternalBulkMessagingConfig>(BASE).then((r) => r.data);

export const updateExternalBulkMessagingConfig = (
  payload: UpdateExternalBulkMessagingConfigPayload,
): Promise<ExternalBulkMessagingConfig> =>
  axiosClient.put<ExternalBulkMessagingConfig>(BASE, payload).then((r) => r.data);
