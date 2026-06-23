import axiosClient from './axios-client';
import type { PaginatedRadiusEvents, PaginatedNe8000Audit } from '@/types/networkAudit';

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

// ── API functions ──────────────────────────────────────────────────────────────

export const getRadiusEvents = (params: RadiusEventsParams): Promise<PaginatedRadiusEvents> =>
  axiosClient
    .get<PaginatedRadiusEvents>('/radius/events', { params })
    .then((r) => r.data);

export const getNe8000Audit = (params: Ne8000AuditParams): Promise<PaginatedNe8000Audit> =>
  axiosClient
    .get<PaginatedNe8000Audit>('/radius/ne8000/audit', { params })
    .then((r) => r.data);
