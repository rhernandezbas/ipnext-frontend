import axiosClient from './axios-client';
import type { NocAlertThresholdsDto, UpdateNocAlertThresholdsPayload } from '@/types/nocAlertThresholds';

/**
 * nocAlertThresholds.api (change `noc-alerts-config`, Fase F FE) — cliente de
 * `/api/alerts/thresholds`. Contrato verificado contra el código REAL del BE
 * (`alerts.routes.ts`):
 *
 * - `GET /alerts/thresholds` → `res.json(dto)` — FLAT, SIN envelope `{data}`.
 * - `PUT /alerts/thresholds` → mismo body, `res.json(dto)` actualizado. Auth
 *   humana ÚNICAMENTE (session + `monitoring.manage`) — a diferencia del GET
 *   (que también acepta la key del collector Rust), el PUT no tiene dual-auth.
 */
const BASE = '/alerts/thresholds';

export const getNocAlertThresholds = (): Promise<NocAlertThresholdsDto> =>
  axiosClient.get<NocAlertThresholdsDto>(BASE).then((r) => r.data);

export const updateNocAlertThresholds = (
  body: UpdateNocAlertThresholdsPayload,
): Promise<NocAlertThresholdsDto> => axiosClient.put<NocAlertThresholdsDto>(BASE, body).then((r) => r.data);
