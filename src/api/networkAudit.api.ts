import axiosClient from './axios-client';
import type {
  PaginatedRadiusEvents,
  PaginatedNe8000Audit,
  PaginatedRadiusAuthEvents,
  RadiusAuthReply,
} from '@/types/networkAudit';

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
