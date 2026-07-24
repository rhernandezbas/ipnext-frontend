/**
 * Umbrales de alertas de fibra (change `noc-alerts-config`, Fase F FE) —
 * mirror EXACTO del `NocAlertThresholdsConfigDto` del BE
 * (`ipnext-backend/src/application/dto/nocAlertThresholds.dto.ts`).
 *
 * Contrato REAL verificado contra `alerts.routes.ts`:
 *  - `GET /api/alerts/thresholds`  → JSON FLAT (SIN envelope `{data}`).
 *  - `PUT /api/alerts/thresholds`  → mismo body, actualiza; requiere las 5
 *    claves presentes y numéricas (el BE NO acepta un PATCH parcial acá).
 *
 * Nombres de campo = contrato de wire con el collector Rust
 * (`serde_json::from_str` directo a su struct) — NUNCA renombrar sin
 * actualizar el BE.
 */
export interface NocAlertThresholdsDto {
  /** Rx (dBm) peor que esto = Crítico. Típicamente el valor MÁS negativo. */
  critDbm: number;
  /** Rx (dBm) peor que esto = Warning. */
  warnDbm: number;
  /** Empeoramiento individual (dB) que se reporta. */
  deltaAlert: number;
  /** Abonados afectados en un mismo PON para sospechar de una fibra/caja compartida. */
  ponMinAbon: number;
  /** Empeoramiento medio del PON (dB) para sospechar de un problema compartido. */
  ponDelta: number;
}

/** Body del PUT — mismo shape que el DTO (las 5 claves son obligatorias). */
export type UpdateNocAlertThresholdsPayload = NocAlertThresholdsDto;
