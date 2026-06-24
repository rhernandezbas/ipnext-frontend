/**
 * Tipos de la página "Historial de servicios de Internet" (espejo de TV).
 * Contrato BE↔FE explícito, espejando los DTOs vivos en prod:
 *   GET /api/pppoe                       → lista paginada server-side
 *   GET /api/pppoe/activation-history    → eventos newest-first
 *
 * No reusamos PppoeServiceDto (types/pppoe.ts) porque el ITEM de lista trae
 * campos de cliente (clientId, customerName, createdBy) que el DTO de gestión
 * por contrato no tiene, y omite enforcedState/remoteAddress que acá no aplican.
 */

/**
 * Estado de NEGOCIO del servicio, COMPUTED por el BE a partir de
 * PppoeService.status (enabled/disabled/terminated) + enforcedState
 * (active/reduced/blocked):
 *   terminated        → baja
 *   disabled/blocked  → blocked
 *   reduced           → reduced
 *   enabled + active  → active
 *   default           → inactive
 * NO es el status de Contract (ese trae 'new'/'late'); NO es el estado RADIUS crudo.
 */
export type InternetServiceStatus = 'active' | 'reduced' | 'blocked' | 'baja' | 'inactive';

/** Un item de la lista de servicios de Internet (GET /api/pppoe → data[]). SIN password. */
export interface PppoeServiceListItem {
  id: string;
  username: string;
  /** Client.id (bare, sin sufijo -seq) para el deep-link al cliente. Null si huérfano. */
  clientId: string | null;
  customerName: string | null;
  /** Estado de negocio. String libre en el wire; lo tratamos como InternetServiceStatus en la UI. */
  status: string;
  /** Plan / profile RADIUS. */
  profile: string | null;
  nasId: string;
  createdBy: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

/** Respuesta paginada de GET /api/pppoe. */
export interface PppoeServiceListResult {
  data: PppoeServiceListItem[];
  total: number;
  page: number;
  limit: number;
}

/** Filtros de la lista. `page`/`limit` los maneja la paginación server-side. */
export interface PppoeServiceListFilter {
  search?: string;
  status?: InternetServiceStatus | '';
  nasId?: string;
  page?: number;
  limit?: number;
}

/**
 * Un evento del historial de activaciones de Internet
 * (GET /api/pppoe/activation-history). Newest-first en el wire.
 */
export interface InternetServiceEvent {
  id: string;
  clientId: string;
  customerName?: string | null;
  contractId?: string | null;
  /** Tipo de evento → badge visual (alta/baja/reactivación). */
  eventType: 'alta' | 'baja' | 'reactivacion';
  actorName: string;
  /** Motivo libre del operador. Null para eventos legacy. */
  reason?: string | null;
  /** ISO timestamp (newest first). */
  createdAt: string;
}

/** Query params del endpoint de historial. Todos opcionales. */
export interface InternetActivationHistoryFilter {
  actorId?: string;
  customerId?: string;
  clientId?: string;
  from?: string;
  to?: string;
}

/** Etiquetas humanas para el filtro/columna de estado. */
export const INTERNET_STATUS_LABELS: Record<InternetServiceStatus, string> = {
  active: 'Activo',
  reduced: 'Reducido',
  blocked: 'Bloqueado',
  baja: 'Baja',
  inactive: 'Inactivo',
};
