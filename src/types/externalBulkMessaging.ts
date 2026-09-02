/**
 * external-bulk-messaging FE (D12/D13) — tipos espejo campo-a-campo del DTO
 * de config del BE (`GetExternalBulkConfig`/`SetExternalBulkConfig`,
 * `externalBulkMessagingConfig.routes.ts`). Contrato:
 *
 *   GET /api/messaging/config/external-bulk → ExternalBulkMessagingConfig  (gate messaging:read)
 *   PUT /api/messaging/config/external-bulk → body UpdateExternalBulkMessagingConfigPayload
 *       → ExternalBulkMessagingConfig  (gate messaging:manage)
 *       400 si no es entero >= 1, o si maxPerRequest > maxPerDay (CONFIG-3)
 *
 * Envelope FLAT en ambos verbos (molde EXACTO `taskStageConfig.ts` — a
 * diferencia de `listBulkTemplates`/`listChatwootLabels`, que envuelven en
 * `{data}`).
 *
 * El kill-switch (`messaging-external-bulk-enabled`) NO tiene tipo propio
 * acá: reusa `FeatureFlag` de `@/types/featureFlag` vía `useFeatureFlag`.
 */
export interface ExternalBulkMessagingConfig {
  maxPerRequest: number;
  maxPerDay: number;
  updatedAt: string;
}

/** Body de PUT — los dos campos son obligatorios (replace, no patch parcial). */
export interface UpdateExternalBulkMessagingConfigPayload {
  maxPerRequest: number;
  maxPerDay: number;
}
