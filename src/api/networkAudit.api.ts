import axiosClient from './axios-client';
import type {
  PaginatedRadiusEvents,
  PaginatedNe8000Audit,
  PaginatedRadiusAuthEvents,
  RadiusAuthReply,
} from '@/types/networkAudit';
import type {
  PaginatedRadiusSessionCureEvents,
  CureSessionBody,
  CureSessionResult,
} from '@/types/radiusSessionCure';

// ── RADIUS Events params ───────────────────────────────────────────────────────

export interface RadiusEventsParams {
  username?: string;
  nasId?: string;
  vlanId?: string;
  eventType?: 'start' | 'stop' | 'interim';
  online?: boolean;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

// ── NE8000 Audit params ────────────────────────────────────────────────────────

export interface Ne8000AuditParams {
  username?: string;
  status?: 'enabled' | 'disabled';
  enforcedState?: 'active' | 'reduced' | 'blocked';
  online?: boolean;
  page?: number;
  limit?: number;
}

// ── RADIUS Auth Failures params ──────────────────────────────────────────────────

export interface RadiusAuthFailuresParams {
  username?: string;
  reply?: RadiusAuthReply;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  /** Filtra la lista por motivo (la columna `reason`). `countsByReason` siempre viene completo. */
  reason?: 'session_stuck' | 'user_not_found' | 'other';
}

// ── RADIUS Session Cures params (radius-session-autocure FE-1) ──────────────────

export interface RadiusSessionCuresParams {
  username?: string;
  outcome?: string;
  trigger?: 'auto' | 'manual';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const getRadiusEvents = (params: RadiusEventsParams): Promise<PaginatedRadiusEvents> =>
  axiosClient
    .get<PaginatedRadiusEvents>('/radius/events', { params })
    .then((r) => r.data);

export const getNe8000Audit = (params: Ne8000AuditParams): Promise<PaginatedNe8000Audit> =>
  axiosClient
    .get<PaginatedNe8000Audit>('/radius/ne8000/audit', { params })
    .then((r) => r.data);

export const getRadiusAuthFailures = (
  params: RadiusAuthFailuresParams,
): Promise<PaginatedRadiusAuthEvents> =>
  axiosClient
    .get<PaginatedRadiusAuthEvents>('/radius/auth-failures', { params })
    .then((r) => r.data);

/** GET /radius/session-cures — auditoría de curas (gate `network.read`, D8). */
export const getRadiusSessionCures = (
  params: RadiusSessionCuresParams,
): Promise<PaginatedRadiusSessionCureEvents> =>
  axiosClient
    .get<PaginatedRadiusSessionCureEvents>('/radius/session-cures', { params })
    .then((r) => r.data);

/**
 * POST /radius/session-cures — cura MANUAL (escape hatch, gate `network.manage`, D8).
 * Sin `force`: respeta los gates fail-closed (409 CURE_SKIPPED_ALIVE/CURE_SKIPPED_AMBIGUOUS
 * si detecta sesión viva/ambigua). Con `force: true` (SOLO tras la segunda confirmación
 * explícita del operador): saltea esos gates. 502 ORCHESTRATOR_UNREACHABLE si el
 * orchestrator no responde. axios lanza para cualquier status fuera de 2xx — el caller
 * inspecciona `err.response.{status,data.code,data.message}` (ver utils/mapCureSessionError).
 */
export const postRadiusSessionCure = (body: CureSessionBody): Promise<CureSessionResult> =>
  axiosClient
    .post<CureSessionResult>('/radius/session-cures', body)
    .then((r) => r.data);
