import axiosClient from './axios-client';
import type {
  EnforcementAction,
  EnforcementTarget,
  EnforcementPreview,
  BulkEnforcementStarted,
  ServiceCutBatch,
  PppoeServiceDto,
  IpTypePreference,
} from '@/types/pppoe';
import type {
  PppoeServiceListResult,
  PppoeServiceListFilter,
  InternetServiceEvent,
  InternetActivationHistoryFilter,
  PppoeActivationOperator,
} from '@/types/internetService';
import type {
  PaginatedPppoeNasMoveEvents,
  PppoeNasMoveOutcome,
  PppoeNasMoveTrigger,
} from '@/types/pppoeNasMove';

const BASE = '/pppoe';
const CONTRACTS_BASE = '/contracts';

export interface CreatePppoeBody {
  username: string;
  password: string;
  /**
   * AUSENTE = pre-provisión sin router (el watcher lo adopta cuando el cliente
   * conecta por primera vez). Wire contract pppoe-preprovision.
   */
  nasId?: string;
  profile?: string;
  remoteAddress?: string;
  /** Tipo de IP elegido por el operador — REQUERIDO (422 VALIDATION_ERROR si falta). */
  ipTypePreference: IpTypePreference;
}

/**
 * Body para crear un PPPoE global (standalone, sin contrato obligatorio).
 * A diferencia de CreatePppoeBody (que va a /contracts/:id/pppoe),
 * este va directo a POST /api/pppoe. El campo es `plan` (no `profile`)
 * según el contrato BE establecido en la Fase 5.
 */
export interface CreateStandalonePppoeBody {
  username: string;
  password: string;
  /**
   * AUSENTE = pre-provisión sin router (auto-instalación por el watcher).
   * Wire contract pppoe-preprovision.
   */
  nasId?: string;
  plan: string;
  framedIp?: string;
  ipMode?: 'fixed' | 'pool';
  /** Tipo de IP elegido por el operador — REQUERIDO (422 VALIDATION_ERROR si falta). */
  ipTypePreference: IpTypePreference;
  /** Asociar a un contrato al crear. Opcional en V1. */
  contractId?: string;
}

/**
 * Resultado de POST /api/pppoe/:id/rename.
 * status='partial' = el secret nuevo se creó pero el viejo no pudo eliminarse.
 */
export interface RenamePppoeResult {
  id: string;
  username: string;
  status: 'ok' | 'partial';
  message?: string;
}

export interface UpdatePppoeBody {
  profile?: string;
  password?: string;
  remoteAddress?: string;
  status?: string;
  reason?: string | null;
}

/**
 * Resultado de POST /api/pppoe/bulk/change-plan.
 * ok = ids que cambiaron exitosamente.
 * failed = items que fallaron con username + error para mostrar en el resumen.
 */
export interface BulkChangePlanResult {
  ok: string[];
  failed: { id: string; username: string; error: string }[];
}

/**
 * Resultado de GET /api/pppoe/ids: solo ids que matchean el filtro (liviano,
 * sin proyección de cliente/enriquecimiento). `ids.length === total` siempre
 * (el endpoint no pagina).
 */
export interface PppoeIdsResult {
  ids: string[];
  total: number;
}

/** Credenciales reveladas bajo demanda (frontera de seguridad: NUNCA viajan en el DTO de lista/detalle). */
export interface PppoeCredentials {
  username: string;
  password: string;
}

/** Filtros del listado de movimientos de NAS (GET /pppoe/nas-move-events). */
export interface PppoeNasMoveEventsParams {
  page?: number;
  limit?: number;
  outcome?: PppoeNasMoveOutcome;
  trigger?: PppoeNasMoveTrigger;
  username?: string;
}

export const pppoeApi = {
  /**
   * Lista paginada (server-side) de servicios de Internet (PPPoE). Gated `pppoe.read`.
   * Devuelve { data, total, page, limit }. El DTO NUNCA incluye password.
   * Los filtros vacíos se omiten del query string para no mandar `?status=`.
   */
  async list(filter: PppoeServiceListFilter = {}): Promise<PppoeServiceListResult> {
    const params: Record<string, string | number> = {};
    if (filter.search && filter.search.trim()) params.search = filter.search.trim();
    if (filter.status) params.status = filter.status;
    if (filter.nasId) params.nasId = filter.nasId;
    if (filter.page !== undefined) params.page = filter.page;
    if (filter.limit !== undefined) params.limit = filter.limit;
    if (filter.includeUnassigned !== undefined) params.includeUnassigned = filter.includeUnassigned ? 'true' : 'false';
    const r = await axiosClient.get<PppoeServiceListResult>(BASE, { params });
    return r.data;
  },

  /**
   * Ids de TODOS los servicios PPPoE que matchean un filtro activo (SIN paginar),
   * para congelar la selección del bulk masivo (pppoe-bulk-select-filter v2).
   * GET /pppoe/ids — gated `pppoe.manage` (NO `pppoe.read`: solo alimenta el bulk).
   * MISMOS filtros que `list()` (search/status/nasId/includeUnassigned), SIN
   * page/limit (el endpoint no pagina). El BE exige AL MENOS un filtro de
   * narrowing (search/status/nasId) — sin ninguno responde 400 FILTER_REQUIRED.
   * Los filtros vacíos se omiten del query string (mismo patrón que `list`).
   */
  async listIds(filter: PppoeServiceListFilter = {}): Promise<PppoeIdsResult> {
    const params: Record<string, string> = {};
    if (filter.search && filter.search.trim()) params.search = filter.search.trim();
    if (filter.status) params.status = filter.status;
    if (filter.nasId) params.nasId = filter.nasId;
    if (filter.includeUnassigned !== undefined) params.includeUnassigned = filter.includeUnassigned ? 'true' : 'false';
    const r = await axiosClient.get<PppoeIdsResult>(`${BASE}/ids`, { params });
    return r.data;
  },

  /**
   * Historial de activaciones de Internet (alta/baja/reactivación). Gated `pppoe.read`.
   * Devuelve InternetServiceEvent[] newest-first. Filtros opcionales por actor/cliente/fecha.
   */
  async activationHistory(
    filter: InternetActivationHistoryFilter = {},
  ): Promise<InternetServiceEvent[]> {
    const params: Record<string, string> = {};
    if (filter.actorId) params.actorId = filter.actorId;
    if (filter.customerId) params.customerId = filter.customerId;
    if (filter.clientId) params.clientId = filter.clientId;
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;
    const r = await axiosClient.get<InternetServiceEvent[]>(`${BASE}/activation-history`, { params });
    return r.data;
  },

  /**
   * Operadores DISTINCT que generaron eventos de Internet (para el <select> del historial).
   * Gated `pppoe.read` (NO requiere admin/rbac, a diferencia de useRbacUsers).
   */
  async activationOperators(): Promise<PppoeActivationOperator[]> {
    const r = await axiosClient.get<PppoeActivationOperator[]>(`${BASE}/activation-history/operators`);
    return r.data;
  },

  /** Impacto del corte SIN ejecutar: total + desglose por router + muestra. */
  async preview(body: { action: EnforcementAction; target: EnforcementTarget }): Promise<EnforcementPreview> {
    const r = await axiosClient.post<EnforcementPreview>(`${BASE}/enforce/preview`, body);
    return r.data;
  },

  /**
   * Dispara el corte MASIVO on-demand → 202 { jobId, total }.
   * Devuelve { status, data } para distinguir el 202; un 409 (ya hay un batch en
   * curso) lo lanza axios y lo maneja el caller por `error.response.status`.
   */
  async startBulk(
    body: { action: EnforcementAction; target: EnforcementTarget },
  ): Promise<{ status: number; data: BulkEnforcementStarted }> {
    const r = await axiosClient.post<BulkEnforcementStarted>(`${BASE}/enforce/bulk`, body);
    return { status: r.status, data: r.data };
  },

  /** Estado poleable del batch de corte. */
  async getBatch(jobId: string): Promise<ServiceCutBatch> {
    const r = await axiosClient.get<ServiceCutBatch>(`${BASE}/enforce/bulk/${jobId}`);
    return r.data;
  },

  /** Corte INDIVIDUAL de un PPPoE (reduce/block/restore). Devuelve el DTO con enforcedState. */
  async enforce(id: string, action: EnforcementAction, reason?: string): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/enforce`, { action, reason });
    return r.data;
  },

  // ── Gestión PPPoE por contrato ───────────────────────────────────────────────

  /** Lista los PPPoE de un contrato. */
  async listByContract(contractId: string): Promise<PppoeServiceDto[]> {
    const r = await axiosClient.get<PppoeServiceDto[]>(`${CONTRACTS_BASE}/${contractId}/pppoe`);
    return r.data;
  },

  /** Crea un PPPoE en un contrato. */
  async create(contractId: string, body: CreatePppoeBody): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${CONTRACTS_BASE}/${contractId}/pppoe`, body);
    return r.data;
  },

  /** Edita un PPPoE (profile, password, remoteAddress, status). */
  async update(id: string, body: UpdatePppoeBody): Promise<PppoeServiceDto> {
    const r = await axiosClient.patch<PppoeServiceDto>(`${BASE}/${id}`, body);
    return r.data;
  },

  /**
   * Mueve un PPPoE a otro NAS. En NAS radius el BE reasigna una IP NUEVA del
   * pool CGNAT del destino y desconecta la sesión (pppoe-move-nas W1); el DTO
   * de respuesta trae `nasId` y `remoteAddress` nuevos.
   * `force: true` = confirmación explícita para mover un servicio con IP
   * PÚBLICA fija (el 409 PPPOE_MOVE_PUBLIC_IP del BE es la señal; el FE no
   * clasifica la IP). La clave se OMITE del body cuando no es true.
   * Errores: 422 NO_FREE_IP, 404 NO_POOL_FOR_NAS_TYPE, 409 PPPOE_MOVE_PUBLIC_IP /
   * PPPOE_TERMINATED / PPPOE_MOVE_MIXED_NAS_TYPES / ORCHESTRATOR_REJECTED, 502.
   */
  async move(id: string, nasId: string, force?: boolean): Promise<PppoeServiceDto> {
    const body: { nasId: string; force?: boolean } = { nasId };
    if (force) body.force = true;
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/move`, body);
    return r.data;
  },

  /** Da de baja (DELETE) un PPPoE — corte real en el router. 204 sin body. */
  async deactivate(id: string, reason?: string): Promise<void> {
    await axiosClient.delete(`${BASE}/${id}`, { data: { reason } });
  },

  // ── Adopción de inventario PPPoE (huérfanos) ─────────────────────────────────

  /**
   * Lista los PPPoE huérfanos (contractId = null) ingeridos del router pero sin
   * asociar a un contrato. El DTO NUNCA incluye password (frontera de seguridad).
   * Gated `pppoe.read`.
   */
  async listUnassigned(): Promise<PppoeServiceDto[]> {
    const r = await axiosClient.get<PppoeServiceDto[]>(`${BASE}/unassigned`);
    return r.data;
  },

  /**
   * Asocia un PPPoE huérfano a un contrato. Devuelve el PPPoE ya asociado.
   * 409 si ya está asociado a OTRO contrato. Gated `pppoe.manage`.
   */
  async associate(id: string, contractId: string): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/associate`, { contractId });
    return r.data;
  },

  /**
   * Desasocia un PPPoE de un contrato: vuelve al inventario de huérfanos (contractId = null)
   * SIN darse de baja en el router. El BE responde 200 con el DTO huérfano (lo ignoramos). Gated `pppoe.manage`.
   */
  async deassociate(contractId: string, pppoeId: string, reason?: string): Promise<void> {
    await axiosClient.delete(`${CONTRACTS_BASE}/${contractId}/pppoe/${pppoeId}`, { data: { reason } });
  },

  // ── Gestión global de PPPoE (sin necesidad de contractId) ───────────────────

  /**
   * Crea un PPPoE standalone (POST /api/pppoe). A diferencia de `create` que requiere
   * un contractId, este endpoint acepta un PPPoE huérfano sin contrato asociado (V1).
   * El campo del plan se llama `plan` (no `profile`) según el BE del Fase 5.
   * Gated `pppoe.manage`.
   */
  async createStandalone(body: CreateStandalonePppoeBody): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(BASE, body);
    return r.data;
  },

  /**
   * Renombra un PPPoE (POST /api/pppoe/:id/rename). Esto RECREA el secret en el
   * RADIUS con el nuevo username y elimina el viejo. El cliente se desconecta y
   * necesita reconfigurar su CPE con el nuevo usuario.
   * status='partial' = el secret nuevo se creó pero el viejo no pudo eliminarse.
   * Gated `pppoe.manage`.
   */
  async rename(id: string, newUsername: string): Promise<RenamePppoeResult> {
    const r = await axiosClient.post<RenamePppoeResult>(`${BASE}/${id}/rename`, { newUsername });
    return r.data;
  },

  /**
   * Revela las credenciales de un PPPoE bajo demanda. ES LA ÚNICA vía para
   * obtener el password (la lista/detalle nunca lo trae). Gated `pppoe.manage`.
   */
  async credentials(id: string): Promise<PppoeCredentials> {
    const r = await axiosClient.get<PppoeCredentials>(`${BASE}/${id}/credentials`);
    return r.data;
  },

  /**
   * Devuelve el caller-id (MAC del dispositivo conectado) de la sesión RADIUS activa,
   * o null si no hay sesión activa. Gated `pppoe.read`.
   */
  async getCallerId(id: string): Promise<{ callerId: string | null }> {
    const r = await axiosClient.get<{ callerId: string | null }>(`${BASE}/${id}/caller-id`);
    return r.data;
  },

  /**
   * Fija una IP estática en el PPPoE (ipMode='fixed', remoteAddress=ip).
   * 422 IP inválida, 409 IP ya tomada, 502 router/orquestador caído.
   * Gated `pppoe.manage`.
   */
  async pinIp(id: string, ip: string): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/pin-ip`, { ip });
    return r.data;
  },

  /**
   * Libera la IP fija del PPPoE (ipMode='pool', remoteAddress=null).
   * 409 si el NAS no tiene pool configurado, 502 router/orquestador caído.
   * Gated `pppoe.manage`.
   */
  async unpinIp(id: string): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/unpin-ip`, {});
    return r.data;
  },

  /**
   * Registro de movimientos de NAS (tab "Movimientos NAS" de la auditoría).
   * Wire contract D6: { items, total, page, limit }. Gated `network.read`
   * (alineado a los tabs vecinos de la page de auditoría).
   * Los filtros vacíos se omiten del query string.
   */
  async listNasMoveEvents(params: PppoeNasMoveEventsParams = {}): Promise<PaginatedPppoeNasMoveEvents> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.outcome) query.outcome = params.outcome;
    if (params.trigger) query.trigger = params.trigger;
    if (params.username && params.username.trim()) query.username = params.username.trim();
    const r = await axiosClient.get<PaginatedPppoeNasMoveEvents>(`${BASE}/nas-move-events`, { params: query });
    return r.data;
  },

  /**
   * Cambia el plan de múltiples PPPoEs en un solo request (bulk).
   * POST /api/pppoe/bulk/change-plan — gated `pppoe.manage`.
   * - ids: hasta 200 ids (el BE valida el tope).
   * - profile: código del plan (debe existir en el catálogo Plan).
   * - reason: motivo opcional del cambio.
   * Respuesta síncrona { ok, failed }: un ítem fallido no aborta el lote (best-effort).
   * Errores HTTP: 400 (ids vacío), 422 (plan inexistente / ids > 200), 403 (sin permiso).
   */
  async bulkChangePlan(ids: string[], profile: string, reason?: string): Promise<BulkChangePlanResult> {
    const body: { ids: string[]; profile: string; reason?: string } = { ids, profile };
    if (reason !== undefined && reason !== null) body.reason = reason;
    const r = await axiosClient.post<BulkChangePlanResult>(`${BASE}/bulk/change-plan`, body);
    return r.data;
  },
};
