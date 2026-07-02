// ---------------------------------------------------------------------------
// Paginated envelope — returned when params (page/limit/search/nasId/status)
// are included in the GET /radius/sessions request.
// ---------------------------------------------------------------------------
export interface RadiusSessionsStats {
  /** Total de sesiones que matchean search+nasId (ignorando status) — el BADGE del tab. */
  total: number;
  active: number;
  idle: number;
}

export interface PaginatedRadiusSessions {
  data: RadiusSession[];
  /** Total de sesiones que matchean TODOS los filtros (incl. status) — governa hasNext. */
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  /** KPIs de estado calculados sobre el set search+nasId (ignoring status). */
  stats: RadiusSessionsStats;
}

// ---------------------------------------------------------------------------
// Params para el hook paginado
// ---------------------------------------------------------------------------
export interface RadiusSessionsParams {
  search?: string;
  nasId?: string;
  status?: 'active' | 'idle';
  page: number;
  limit: number;
}

export interface RadiusSession {
  id: string;
  sessionId: string;
  /**
   * Trio contractId/clientId/customerName puede venir null desde el BE:
   * una sesión PPPoE activa puede no estar asociada a un contrato/cliente
   * conocido todavía (alta sin contrato, MAC huérfana, etc.).
   */
  contractId: string | null;
  clientId: string | null;
  customerName: string | null;
  clientName: string;
  // W1: el BE serializa estos 4 campos como string | null (el RADIUS/router
  // puede no resolverlos). Los consumidores ya son defensivos (`?? '—'` en la
  // tabla; `sessNasOptions` filtra por truthy antes de usar `nasIpAddress` del
  // NAS server, que es un campo DISTINTO de `RadiusSession.nasId`).
  nasId: string | null;
  nasName: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  startedAt: string;
  duration: number;
  downloadBytes: number;
  uploadBytes: number;
  downloadMbps: number;
  uploadMbps: number;
  status: 'active' | 'idle';
  username: string;
}
