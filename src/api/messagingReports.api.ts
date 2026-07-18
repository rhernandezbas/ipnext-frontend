import axiosClient from './axios-client';
import type {
  ReportsDateRange,
  ReportsOverview,
  ReportsResolutions,
  ReportsTraffic,
} from '@/types/messagingReports';

/**
 * messagingReports.api (Ola 3 dashboard) — cliente del router
 * `/api/messaging/reports` (auth + `messaging:read`). Contrato BE (ya en prod):
 *
 * - `GET /overview?from=&to=`    → `ReportsOverview` (FLAT, sin envelope)
 * - `GET /traffic?from=&to=`     → `ReportsTraffic`  (cells solo count>0)
 * - `GET /resolutions?from=&to=` → `ReportsResolutions` (days solo count>0, asc)
 *
 * `from`/`to` son UTC ISO; el rango es semiabierto `[from, to)`. Respuestas
 * FLAT (mismo criterio que `getWhatsappConversation`) — no hay `{data}` que
 * desenvolver.
 */

const BASE = '/messaging/reports';

const rangeParams = (range: ReportsDateRange) => ({ from: range.from, to: range.to });

export const getReportsOverview = (range: ReportsDateRange): Promise<ReportsOverview> =>
  axiosClient.get<ReportsOverview>(`${BASE}/overview`, { params: rangeParams(range) }).then((r) => r.data);

export const getReportsTraffic = (range: ReportsDateRange): Promise<ReportsTraffic> =>
  axiosClient.get<ReportsTraffic>(`${BASE}/traffic`, { params: rangeParams(range) }).then((r) => r.data);

export const getReportsResolutions = (range: ReportsDateRange): Promise<ReportsResolutions> =>
  axiosClient
    .get<ReportsResolutions>(`${BASE}/resolutions`, { params: rangeParams(range) })
    .then((r) => r.data);
