/**
 * Tipos del registro de curas de sesiones RADIUS colgadas (radius-session-autocure
 * FE-1, REQ-FE-CURE-1/2). Wire contract del BE campo por campo (design D8):
 *   GET  /api/radius/session-cures → { data, total, page, limit, hasNext, countsByOutcome }
 *   POST /api/radius/session-cures → { outcome, reason, events } (200) |
 *        409 CURE_SKIPPED_ALIVE/CURE_SKIPPED_AMBIGUOUS | 502 ORCHESTRATOR_UNREACHABLE
 */

export type RadiusSessionCureTrigger = 'auto' | 'manual';

export type RadiusSessionCureSignal = 'persistent_rejects' | 'stale_interim';

export type RadiusSessionCureAction = 'both' | 'acct_close' | 'coa';

/**
 * Outcomes que persiste el BE. FUENTE ÚNICA para los chips/filtro/badges del
 * tab — agregar un outcome acá los habilita en los tres a la vez. El campo
 * `outcome` es un String LIBRE del lado del BE (sin migración para agregar
 * outcomes nuevos) — el FE tipa el union CONOCIDO y degrada a texto plano
 * cualquier valor fuera de esta lista (lección OutcomeBadge, D-W2.5.5).
 */
export const RADIUS_SESSION_CURE_OUTCOMES = [
  'cured',
  'already_cured',
  'skipped_alive',
  'skipped_ambiguous',
  'skipped_no_session',
  'skipped_no_signal',
  'flagged_flapping',
  'failed',
] as const;

export type RadiusSessionCureOutcome = (typeof RADIUS_SESSION_CURE_OUTCOMES)[number];

export interface RadiusSessionCureEvent {
  id: string;
  username: string;
  nasIp: string | null;
  sessionId: string | null;
  sessionStartedAt: string | null;   // ISO 8601
  sessionLastUpdate: string | null;  // ISO 8601 — el interim al momento de evaluar
  signalUsed: RadiusSessionCureSignal | null;
  trigger: RadiusSessionCureTrigger;
  action: RadiusSessionCureAction | null;
  /** Tipado como string para tolerar outcomes nuevos del BE sin romper el FE. */
  outcome: string;
  reason: string | null;
  actorName: string | null;
  createdAt: string; // ISO 8601
}

export interface CountsByOutcome {
  cured: number;
  already_cured: number;
  skipped_alive: number;
  skipped_ambiguous: number;
  skipped_no_session: number;
  skipped_no_signal: number;
  flagged_flapping: number;
  failed: number;
}

export interface PaginatedRadiusSessionCureEvents {
  data: RadiusSessionCureEvent[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  /** Desglose COMPLETO por outcome — NO cambia al filtrar por outcome (siempre el total). */
  countsByOutcome: CountsByOutcome;
}

/** Body de POST /api/radius/session-cures — cura manual (escape hatch, REQ-FE-CURE-2). */
export interface CureSessionBody {
  username: string;
  sessionId?: string;
  /** SIEMPRE explícito: el FE nunca lo manda `true` sin la segunda confirmación del operador. */
  force?: boolean;
}

/** Respuesta 200 (y también el body de los 409/502 tipados — mismo shape + code/message). */
export interface CureSessionResult {
  outcome: string;
  reason: string | null;
  events: RadiusSessionCureEvent[];
}
