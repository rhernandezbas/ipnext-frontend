import type { ServiceEventType } from './serviceEvents';

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
  /** Null = pendiente de instalación (pre-provisión sin NAS, feature pppoe-preprovision). */
  nasId: string | null;
  createdBy: string | null;
  /** ISO timestamp. */
  createdAt: string;
  // ── Campos ampliados para la tab de gestión global (Phase 5) ──────────────
  /** Estado de enforcement del secret RADIUS: active | reduced | blocked. */
  enforcedState?: string;
  /** IP asignada actualmente (null = pool, sin sesión activa, o no aplica). */
  remoteAddress?: string | null;
  /** Modo de asignación de IP: 'fixed' = IP pinneada, 'pool' = asignada desde pool. */
  ipMode?: 'fixed' | 'pool';
  /** Nombre legible del NAS donde vive el secret (el id está en nasId). */
  nasName?: string | null;
  /** Tipo del NAS (mikrotik_api, radius_orchestrator, etc.). */
  nasType?: string | null;
  /** Contrato al que está vinculado. Null = servicio huérfano sin contrato. */
  contractId?: string | null;
  /**
   * MAC del CPE (caller-id del RADIUS). Se persiste aunque la sesión caiga.
   * Null = nunca se vio sesión (servicio recién creado o sin sesión RADIUS aún).
   * Expuesto en el DTO de lista a partir de la feature pppoe-search-bulk-plan.
   */
  callerId?: string | null;
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
  /** Incluir servicios sin contrato (huérfanos). Por defecto el BE los omite. */
  includeUnassigned?: boolean;
  /**
   * Solo pendientes de instalación (nasId IS NULL, pre-provisión sin router).
   * pppoe-preprovision: server-side en GET /pppoe y GET /pppoe/ids; en el ids
   * CUENTA como filtro de narrowing (D6.7 — no dispara 400 FILTER_REQUIRED).
   */
  pending?: boolean;
}

/**
 * Dirección de un cambio de plan (solo eventType === 'modified'). El resto de
 * los eventos siempre tiene direction: null — internet-history-plan-direction.
 */
export type PlanChangeDirection = 'upgrade' | 'downgrade';

/**
 * Un evento del historial de activaciones de Internet
 * (GET /api/pppoe/activation-history). Newest-first en el wire.
 */
export interface InternetServiceEvent {
  id: string;
  /** Client.id (bare). Null para PPPoE huérfano sin cliente asociado (W3). */
  clientId: string | null;
  customerName?: string | null;
  contractId?: string | null;
  /**
   * Tipo de evento → badge visual. Fuente canónica: ServiceEventType.
   * Espeja contract-services.dto.ts:88 del BE.
   * El badge los mapea a etiqueta español; un valor desconocido cae al default.
   */
  eventType: ServiceEventType;
  actorName: string;
  /** Motivo libre del operador. Null para eventos legacy. */
  reason?: string | null;
  /** ISO timestamp (newest first). */
  createdAt: string;
  /**
   * Dirección del cambio de plan, COMPUTED por el BE. Null salvo que el evento
   * sea un cambio de plan real (eventType === 'modified'). Opcional para no
   * romper fixtures viejos que no lo incluyen (internet-history-plan-direction).
   */
  direction?: PlanChangeDirection | null;
  /** Código del plan anterior (solo eventType === 'modified'); null en el resto. */
  oldPlan?: string | null;
  /** Código del plan nuevo (solo eventType === 'modified'); null en el resto. */
  newPlan?: string | null;
  /**
   * pppoe-change-audit — tipo de cambio auditado en un evento 'modified':
   * 'ip' | 'password' | 'status' | null. null (o ausente) = cambio de plan / otro,
   * que renderiza con oldPlan/newPlan. Opcional para no romper fixtures previos.
   */
  changeKind?: string | null;
  /**
   * Valor anterior del campo auditado (IP o estado). NUNCA la contraseña —
   * el BE no la incluye. null cuando no aplica.
   */
  oldValue?: string | null;
  /**
   * Valor nuevo del campo auditado (IP o estado). NUNCA la contraseña —
   * el BE no la incluye. null cuando no aplica.
   */
  newValue?: string | null;
}

/**
 * Operador DISTINCT que generó eventos de Internet, para poblar el <select> del
 * historial. Lo sirve GET /api/pppoe/activation-history/operators (gate pppoe.read):
 * a diferencia de useRbacUsers (que pedía admin/rbac), un usuario pppoe.read-only
 * SÍ puede leerlo. `actorId` es el value del <option>; `actorName` el label.
 */
export interface PppoeActivationOperator {
  actorId: string;
  actorName: string;
}

/** Query params del endpoint de historial. Todos opcionales. */
export interface InternetActivationHistoryFilter {
  actorId?: string;
  customerId?: string;
  clientId?: string;
  from?: string;
  to?: string;
  /** Filtro por tópico (tipo de evento) — server-side. */
  eventType?: ServiceEventType;
  /**
   * Filtro por dirección de cambio de plan — server-side. Independiente de
   * eventType: los eventos que no son 'modified' tienen direction: null, así
   * que quedan excluidos cuando este filtro está seteado.
   */
  direction?: PlanChangeDirection;
}

/** Etiquetas humanas para el filtro/columna de estado. */
export const INTERNET_STATUS_LABELS: Record<InternetServiceStatus, string> = {
  active: 'Activo',
  reduced: 'Reducido',
  blocked: 'Bloqueado',
  baja: 'Baja',
  inactive: 'Inactivo',
};
