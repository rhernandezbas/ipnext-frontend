import axiosClient from './axios-client';
import type {
  EnforcementAction,
  EnforcementTarget,
  EnforcementPreview,
  BulkEnforcementStarted,
  ServiceCutBatch,
  PppoeServiceDto,
} from '@/types/pppoe';

const BASE = '/pppoe';
const CONTRACTS_BASE = '/contracts';

export interface CreatePppoeBody {
  username: string;
  password: string;
  nasId: string;
  profile?: string;
  remoteAddress?: string;
}

export interface UpdatePppoeBody {
  profile?: string;
  password?: string;
  remoteAddress?: string;
  status?: string;
}

/** Credenciales reveladas bajo demanda (frontera de seguridad: NUNCA viajan en el DTO de lista/detalle). */
export interface PppoeCredentials {
  username: string;
  password: string;
}

export const pppoeApi = {
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
  async enforce(id: string, action: EnforcementAction): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/enforce`, { action });
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

  /** Mueve un PPPoE a otro router (NAS). */
  async move(id: string, nasId: string): Promise<PppoeServiceDto> {
    const r = await axiosClient.post<PppoeServiceDto>(`${BASE}/${id}/move`, { nasId });
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

  /**
   * Revela las credenciales de un PPPoE bajo demanda. ES LA ÚNICA vía para
   * obtener el password (la lista/detalle nunca lo trae). Gated `pppoe.manage`.
   */
  async credentials(id: string): Promise<PppoeCredentials> {
    const r = await axiosClient.get<PppoeCredentials>(`${BASE}/${id}/credentials`);
    return r.data;
  },
};
