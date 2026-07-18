/**
 * Tipos del dominio "Informes" de mensajería (Ola 3 — dashboard Reports).
 * Contrato BE (ya en prod): `/api/messaging/reports`, gate `messaging:read`.
 * `from`/`to` viajan como UTC ISO; el rango es semiabierto `[from, to)`.
 * El BE agrupa `traffic`/`resolutions` en hora de America/Argentina/Buenos_Aires
 * y devuelve SOLO celdas/días con `count > 0` (el FE rellena los huecos).
 */

/** Rango absoluto en UTC ISO — `to` es EXCLUSIVO (`[from, to)`). */
export interface ReportsDateRange {
  from: string;
  to: string;
}

/** `GET /overview` — todos number. `*InRange` histórico; `current*` en vivo. */
export interface ReportsOverview {
  resolvedInRange: number;
  createdInRange: number;
  currentOpen: number;
  currentUnattended: number;
  currentUnassigned: number;
  currentPending: number;
}

/** Celda del heatmap. `dow` 0=domingo..6=sábado, `hour` 0..23, ambos en hora AR. */
export interface TrafficCell {
  dow: number;
  hour: number;
  count: number;
}

/** `GET /traffic` — `cells` solo con `count > 0`. */
export interface ReportsTraffic {
  timezone: string;
  cells: TrafficCell[];
}

/** Un día de resoluciones. `date` en formato `YYYY-MM-DD` (calendario AR). */
export interface ResolutionDay {
  date: string;
  count: number;
}

/** `GET /resolutions` — `days` solo con `count > 0`, ascendente. */
export interface ReportsResolutions {
  timezone: string;
  days: ResolutionDay[];
}
