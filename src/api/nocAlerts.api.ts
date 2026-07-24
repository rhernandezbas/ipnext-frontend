import axiosClient from './axios-client';
import type { NocAlertDto } from '@/types/nocAlert';

/**
 * nocAlerts.api (Fase C FE, change `noc-alerts-hub`) — cliente del router
 * `/api/alerts`. Contrato verificado contra el código REAL del BE
 * (`alerts.routes.ts`):
 *
 * - `GET /alerts`               → `res.json({data})` — envelope, unwrap acá.
 * - `POST /alerts/:id/acknowledge` → `res.json(dto)` — FLAT, sin envelope.
 * - `GET /alerts/stream`        → SSE (no HTTP normal, no pasa por axios —
 *   ver `NOC_ALERTS_STREAM_URL`, consumido directo con `EventSource` desde
 *   `useNocAlertsStream`).
 *
 * `listNocAlerts` NO manda `source`/`severity`/`status` como querystring: el
 * panel pide la lista COMPLETA una sola vez y filtra client-side (ver
 * comentario en `useNocAlerts.ts` — `nocAlertsKey` es una ÚNICA cache entry
 * para que los frames del SSE tengan un solo lugar donde aplicarse,
 * cualquiera sea el filtro que el usuario tenga elegido).
 */

const BASE = '/alerts';

/** Ruta absoluta (no relativa a axios) — `EventSource` no tiene noción de baseURL. */
export const NOC_ALERTS_STREAM_URL = '/api/alerts/stream';

export const listNocAlerts = (): Promise<NocAlertDto[]> =>
  axiosClient.get<{ data: NocAlertDto[] }>(BASE).then((r) => r.data.data);

export const acknowledgeNocAlert = (id: string, note?: string): Promise<NocAlertDto> =>
  axiosClient
    .post<NocAlertDto>(`${BASE}/${id}/acknowledge`, note ? { note } : {})
    .then((r) => r.data);
