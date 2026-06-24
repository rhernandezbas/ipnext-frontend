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

export interface RadiusAuthEvent {
  id: string;
  username: string;
  reply: RadiusAuthReply;
  authdate: string;        // ISO 8601
  class: string | null;
}

export interface PaginatedRadiusAuthEvents {
  data: RadiusAuthEvent[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}
