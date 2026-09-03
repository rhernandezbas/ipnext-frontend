/**
 * twilio-credit-guard FE (D8) — tipos espejo campo-a-campo del contrato del
 * BE (`GetMessagingRatesConfig`/`SetMessagingRatesConfig`/`GetMessagingCredit`,
 * `messaging-rates-config.routes.ts`). Contrato:
 *
 *   GET  /api/messaging/config/rates          → MessagingRatesConfig   (gate messaging:read)
 *   PUT  /api/messaging/config/rates          → body UpdateMessagingRatesConfigPayload
 *        → MessagingRatesConfig  (gate messaging:manage)
 *        400 VALIDATION_ERROR si una tarifa no matchea `/^\d+(\.\d{1,4})?$/` o
 *        `currency` no matchea `/^[A-Z]{3}$/`
 *   GET  /api/messaging/config/rates/balance  → MessagingCreditBalance (gate messaging:read)
 *        503 CREDIT_UNAVAILABLE si el balance no se pudo leer
 *
 * Envelope FLAT en las 3 llamadas (molde EXACTO `externalBulkMessaging.ts`).
 *
 * Las 4 tarifas y `providerFee` viajan SIEMPRE como `string` de hasta 4
 * decimales ('0.0120') — NUNCA `number`. Un `parseFloat` client-side
 * reintroduce el float que la aritmética de punto fijo del BE (D2) saca de
 * raíz; ver `@/utils/messagingMoney.ts`.
 */
export interface MessagingRatesConfig {
  currency: string;
  utilityRate: string;
  marketingRate: string;
  authenticationRate: string;
  providerFee: string;
  updatedAt: string;
}

/** Body de PUT — replace completo, los 5 campos son obligatorios. */
export interface UpdateMessagingRatesConfigPayload {
  currency: string;
  utilityRate: string;
  marketingRate: string;
  authenticationRate: string;
  providerFee: string;
}

export interface MessagingCreditBalance {
  available: string;
  currency: string;
  fetchedAt: string;
  cached: boolean;
}

/** Las 3 categorías de template que tarifa el BE (`EstimateMessagingCost`). */
export type MessagingRateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
