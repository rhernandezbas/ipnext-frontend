/**
 * Tipos del registro de movimientos de NAS PPPoE (pppoe-move-nas, REQ-LOG-1).
 *
 * Wire contract del BE (design D6, campo por campo):
 *   GET /api/pppoe/nas-move-events → { items, total, page, limit }
 */

export type PppoeNasMoveTrigger = 'manual' | 'auto';

/**
 * Outcomes que persiste el BE. FUENTE ÚNICA para el select de filtro y los
 * badges del tab (agregar un outcome acá lo habilita en ambos).
 */
export const PPPOE_NAS_MOVE_OUTCOMES = [
  'moved',
  'failed_no_free_ip',
  'failed_orchestrator',
  'failed_db',
  'failed_router',
  'skipped_public',
  'skipped_unknown_nas',
  // W2 (D-W2.5) — el watcher auto-move NO actúa en casos dudosos, pero los registra:
  'skipped_stale_session', // la sesión ganadora es vieja/colgada (> freshness) → no mover
  'skipped_nas_conflict',  // sesiones vivas en 2 NAS a la vez → estado ambiguo, no mover
] as const;

export type PppoeNasMoveOutcome = (typeof PPPOE_NAS_MOVE_OUTCOMES)[number];

/** Referencia mínima al NAS (null cuando el NAS ya no existe / no se resolvió). */
export interface PppoeNasMoveNasRef {
  id: string;
  name: string;
}

export interface PppoeNasMoveEvent {
  id: string;
  username: string;
  fromNas: PppoeNasMoveNasRef | null;
  toNas: PppoeNasMoveNasRef | null;
  fromIp: string | null;
  toIp: string | null;
  trigger: PppoeNasMoveTrigger;
  outcome: PppoeNasMoveOutcome;
  /** Detalle del outcome (ej: 'kick_failed'); null cuando no aplica. */
  reason: string | null;
  /** Operador que disparó el move manual; null en auto-move. */
  actorName: string | null;
  createdAt: string; // ISO 8601
}

export interface PaginatedPppoeNasMoveEvents {
  items: PppoeNasMoveEvent[];
  total: number;
  page: number;
  limit: number;
}
