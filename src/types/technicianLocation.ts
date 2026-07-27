/**
 * Ubicación y auditoría de presencia de cuadrillas (change `iclass-gps-audit`).
 *
 * Espejo EXACTO de los DTOs del backend. Los `Date` del dominio viajan como ISO
 * strings por JSON, así que acá son `string`.
 *
 * Endpoints (montados en `/api/technicians`):
 *   GET /live                        → { data: TeamLiveStatus[] }
 *   GET /:login/journey?day=…        → { data: TeamDailyJourney }
 *   GET /audit/service-order/:code   → { data: ServiceOrderPresenceReport }
 *   GET /audit/suspicious-closures   → { data: SuspiciousClosure[], meta: { thresholdMinutes } }
 */

/** Estado de rastreo de una cuadrilla. NO es su estado administrativo en IClass. */
export type TeamLiveState =
  /** Reportó dentro de la ventana de frescura. */
  | 'ACTIVA'
  /** Tiene rastro, pero viejo (>24 h). Se rotula, nunca se dibuja como posición actual. */
  | 'DESACTUALIZADA'
  /** Nunca reportó — típicamente un login cancelado o duplicado. */
  | 'SIN_RASTRO';

export interface TeamLiveStatus {
  login: string;
  name: string;
  /**
   * Estado administrativo en IClass. NO determina si la cuadrilla trackea:
   * se midió una cuadrilla "Inativo" que reportó 28 puntos el mismo día.
   */
  iclassStatus: string | null;
  state: TeamLiveState;
  latitude: number | null;
  longitude: number | null;
  /** ISO-8601 UTC. */
  lastPointAt: string | null;
  accuracyMeters: number | null;
  minutesSinceLastPoint: number | null;
  mapsUrl: string | null;
}

export interface TeamDailyJourney {
  teamLogin: string;
  /** "yyyy-MM-dd" — día calendario argentino. */
  argentinaDay: string;
  pointCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  /** Puntos por hora ARGENTINA, con la hora como clave de 2 dígitos ("06", "07", …). */
  pointsByHour: Record<string, number>;
  /** Cota INFERIOR del recorrido, en metros. Nunca el valor exacto. */
  travelledMetersLowerBound: number;
  /** Siempre true: el contrato de este número es "mínimo estimado". */
  isLowerBound: true;
  /** Mediana del intervalo entre puntos, en minutos. `null` con menos de 2 puntos. */
  medianSamplingMinutes: number | null;
}

export type PresenceVerdict =
  /** Hubo cobertura GPS y al menos un punto compatible con el domicilio. */
  | 'EN_SITIO'
  /** Cobertura SUFICIENTE y ningún punto compatible con el domicilio. */
  | 'FUERA_DE_SITIO'
  /** No hay datos suficientes para concluir. NO significa que la cuadrilla no haya ido. */
  | 'NO_CONCLUYENTE'
  /** La orden no admite auditoría (sin domicilio geolocalizado, sin cuadrilla o sin ventana). */
  | 'NO_AUDITABLE';

/** Ventana temporal evaluada, derivada del histórico de estados de la orden. */
export interface PresenceTimeWindow {
  from: string;
  to: string;
}

export interface ServiceOrderPresenceReport {
  verdict: PresenceVerdict;
  reason: string | null;
  /** Distancia CRUDA del punto elegido, sin descontar precisión. Es evidencia. */
  minDistanceMeters: number | null;
  closestPointAt: string | null;
  closestAccuracyMeters: number | null;
  /** Puntos válidos de esa cuadrilla dentro de la ventana. Mide la solidez del veredicto. */
  pointsEvaluated: number;
  largestCoverageGapMinutes: number | null;
  window: PresenceTimeWindow | null;
  mapsUrl: string | null;
  onSiteThresholdMeters: number;
  serviceOrderCode: string;
  teamLogin: string | null;
  teamTechnicianName: string | null;
  resultCodeName: string | null;
  /**
   * `coordenadasFechamento` de IClass. Medido 2026-07-26: viene vacío en 0 de 416 OS.
   * Se reporta como ausente — jamás se infiere.
   */
  closureCoordinates: { latitude: number; longitude: number; at: string | null } | null;
}

export interface SuspiciousClosure {
  serviceOrderCode: string;
  iclassId: string;
  executionMinutes: number;
  teamLogin: string | null;
  teamTechnicianName: string | null;
  resultCodeName: string | null;
  soTypeDescription: string | null;
  /** Siempre true: el contrato de esta lista es "revisar", no "sancionar". */
  isCandidateForReview: true;
}

export interface SuspiciousClosuresResult {
  candidates: SuspiciousClosure[];
  /** El umbral que APLICÓ el servidor, no el que pidió el usuario. */
  thresholdMinutes: number;
}

export interface SuspiciousClosuresQuery {
  /** "yyyy-MM-dd" */
  from: string;
  /** "yyyy-MM-dd" */
  to: string;
  thresholdMinutes?: number;
}
