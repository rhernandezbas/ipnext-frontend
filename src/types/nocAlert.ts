/**
 * NOC alerts hub (Fase C FE, change `noc-alerts-hub`) — mirror EXACTO del
 * `NocAlertDto` del BE (`ipnext-backend/src/application/dto/nocAlert.ts`).
 * Ningún campo interno (`fingerprint`, `telegramChatId`/`telegramMessageId`)
 * cruza el wire — ese es un allow-list del BE, este tipo solo refleja lo que
 * el DTO realmente expone.
 */

export type NocAlertSeverity = 'critical' | 'warning' | 'info';
export type NocAlertStatus = 'firing' | 'resolved';

export interface NocAlertDto {
  id: string;
  source: string;
  alertname: string;
  severity: NocAlertSeverity;
  status: NocAlertStatus;
  entityType: string;
  entityName: string;
  entityRef: string | null;
  metricName: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  threshold: number | null;
  message: string;
  explanation: string | null;
  link: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  acknowledged: boolean;
  ackBy: string | null;
  ackAt: string | null;
  ackNote: string | null;
  mttaSeconds: number | null;
}

/** Frame shape written by `GET /api/alerts/stream` (spec.md "Connected clients receive alert events"). */
export type NocAlertStreamEventType = 'firing' | 'resolved' | 'acked';

export interface NocAlertStreamEvent {
  type: NocAlertStreamEventType;
  alert: NocAlertDto;
}

/** Client-side-only filter selection (AlertsPage) — '' means "todas".
 *  `alertname` (change `noc-alerts-dashboard`, resumen por tipo) NO tiene un
 *  <Select> propio — se setea/clearea desde los tiles clickeables del
 *  resumen (`AlertsSummary`), reusando este MISMO estado de filtros en vez de
 *  duplicar lógica de filtrado client-side. */
export interface NocAlertFilterState {
  source: string;
  severity: NocAlertSeverity | '';
  status: NocAlertStatus | '';
  alertname: string;
}

export const EMPTY_NOC_ALERT_FILTERS: NocAlertFilterState = {
  source: '',
  severity: '',
  status: '',
  alertname: '',
};
