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
};
