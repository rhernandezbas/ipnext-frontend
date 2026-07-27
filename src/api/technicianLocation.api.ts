import axiosClient from './axios-client';
import type {
  ServiceOrderPresenceReport,
  SuspiciousClosure,
  SuspiciousClosuresQuery,
  SuspiciousClosuresResult,
  TeamDailyJourney,
  TeamLiveStatus,
} from '@/types/technicianLocation';

/**
 * Cliente HTTP del módulo de ubicación/auditoría de cuadrillas (`iclass-gps-audit`).
 *
 * ENVELOPE: este backend envuelve TODO en `{ data }` → se desenvuelve `r.data.data`
 * acá, UNA sola vez, y las pages consumen el shape ya limpio. `suspiciousClosures`
 * además trae `meta.thresholdMinutes`: es el umbral que APLICÓ el servidor y es el
 * único que se puede mostrar (pedir 30 y ver resultados de 5 sin enterarse lleva a
 * concluir "no hay más casos" sobre datos de otro umbral).
 *
 * Los tests mockeados de page NO cazan un mismatch de envelope — por eso hay un
 * test dedicado en `src/__tests__/technicians/technicianLocation.api.test.ts`.
 */

const BASE = '/technicians';

export const technicianLocationApi = {
  /** Estado en vivo del ROSTER completo de cuadrillas. */
  live: (): Promise<TeamLiveStatus[]> =>
    axiosClient.get<{ data: TeamLiveStatus[] }>(`${BASE}/live`).then((r) => r.data.data),

  /**
   * Jornada de una cuadrilla en un día calendario argentino ("yyyy-MM-dd").
   * `day` es OBLIGATORIO: el backend rechaza la request sin él.
   */
  journey: (login: string, day: string): Promise<TeamDailyJourney> =>
    axiosClient
      .get<{ data: TeamDailyJourney }>(`${BASE}/${encodeURIComponent(login)}/journey`, {
        params: { day },
      })
      .then((r) => r.data.data),

  auditServiceOrder: (code: string): Promise<ServiceOrderPresenceReport> =>
    axiosClient
      .get<{ data: ServiceOrderPresenceReport }>(
        `${BASE}/audit/service-order/${encodeURIComponent(code)}`,
      )
      .then((r) => r.data.data),

  suspiciousClosures: (query: SuspiciousClosuresQuery): Promise<SuspiciousClosuresResult> => {
    const params: Record<string, string | number> = { from: query.from, to: query.to };
    if (query.thresholdMinutes !== undefined) params.thresholdMinutes = query.thresholdMinutes;

    return axiosClient
      .get<{ data: SuspiciousClosure[]; meta: { thresholdMinutes: number } }>(
        `${BASE}/audit/suspicious-closures`,
        { params },
      )
      .then((r) => ({ candidates: r.data.data, thresholdMinutes: r.data.meta.thresholdMinutes }));
  },
};
