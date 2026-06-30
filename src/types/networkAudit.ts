// ── RADIUS Events ─────────────────────────────────────────────────────────────

export interface RadiusEvent {
  id: string;
  username: string;
  nasId: string | null;
  nasIpAddress: string;
  nasName: string | null;
  framedIp: string | null;
  macAddress: string | null;
  vlanId: number | null;
  startedAt: string;               // ISO 8601
  stoppedAt: string | null;        // ISO 8601, null = session active
  sessionTimeSeconds: number | null;
  inOctets: string;                // BigInt as string
  outOctets: string;               // BigInt as string
  eventType: 'start' | 'stop' | 'interim';
  status: 'online' | 'closed';
  online: boolean;
}

export interface PaginatedRadiusEvents {
  data: RadiusEvent[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// ── NE8000 Audit ──────────────────────────────────────────────────────────────

export interface Ne8000AuditRow {
  pppoeId: string;
  username: string;
  profile: string | null;           // commercial plan
  remoteAddress: string | null;     // assigned IP
  macAddress: string | null;
  status: string;                   // enabled | disabled
  enforcedState: string;            // active | reduced | blocked
  contractId: string | null;
  currentlyOnline: boolean;
  lastStartedAt: string | null;     // ISO 8601
  lastStoppedAt: string | null;     // ISO 8601
  lastFramedIp: string | null;
  lastVlanId: number | null;
}

export interface PaginatedNe8000Audit {
  data: Ne8000AuditRow[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// ── RADIUS Auth Events (intentos de autenticación) ───────────────────────────────

export type RadiusAuthReply = 'Access-Accept' | 'Access-Reject';

/**
 * Presets de rango RELATIVO (ventana deslizante). El valor identifica el TIPO de
 * ventana ("últimos 5min / 1h / 24h / 7d"), NO un `from` absoluto congelado: el
 * `from` real se calcula al momento del fetch (ver useRadiusAuthFailures).
 */
export type RelativeRange = '5m' | '1h' | '24h' | '7d';

export interface RadiusAuthEvent {
  id: string;
  username: string;
  reply: RadiusAuthReply;
  authdate: string;        // ISO 8601
  class: string | null;
  // Motivo del rechazo, computado por el orchestrator y persistido por el BE:
  //   'user_not_found' | 'session_stuck' | 'other' | null (Access-Accept / históricos viejos).
  // Tipado como string para tolerar valores nuevos del BE sin romper el FE.
  reason: string | null;
}

export interface CountsByReason {
  session_stuck: number;
  user_not_found: number;
  other: number;
}

export interface PaginatedRadiusAuthEvents {
  data: RadiusAuthEvent[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  /** Desglose COMPLETO por motivo — NO cambia al filtrar por reason (siempre el total). */
  countsByReason: CountsByReason;
}
