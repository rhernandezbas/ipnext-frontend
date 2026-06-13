import axiosClient from './axios-client';
import type {
  GigaredConfig,
  UpdateGigaredConfigPayload,
  GigaredSummary,
  ListAccountsFilter,
  ListAccountsResult,
  CustomerAccountResult,
  LinkCicPayload,
  LinkCicResult,
  RegisterAccountPayload,
  RegisterAccountResult,
  AddTvServicePayload,
  AddTvServiceResult,
  RemoveTvServiceResult,
  SetOttPayload,
  CancelTvPayload,
  CancelTvResult,
  CancelStatusResult,
  ChangeTvPasswordPayload,
  ChangeTvPasswordResult,
  TvCredentials,
  TvActivationEvent,
  ActivationHistoryFilter,
} from '@/types/gigared';

const BASE = '/gigared';

/** Map camelCase filter to the snake_case query params the BE expects. */
function toAccountsParams(filter: ListAccountsFilter = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filter.email) params.email = filter.email;
  if (filter.status) params.status = filter.status;
  if (filter.accountId) params.account_id = filter.accountId;
  if (filter.paginationLimit !== undefined) params.pagination_limit = filter.paginationLimit;
  if (filter.paginationOffset !== undefined) params.pagination_offset = filter.paginationOffset;
  return params;
}

export const gigaredApi = {
  async getConfig(): Promise<GigaredConfig> {
    const r = await axiosClient.get<GigaredConfig>(`${BASE}/config`);
    return r.data;
  },

  async updateConfig(body: UpdateGigaredConfigPayload): Promise<GigaredConfig> {
    const r = await axiosClient.put<GigaredConfig>(`${BASE}/config`, body);
    return r.data;
  },

  async getSummary(): Promise<GigaredSummary> {
    const r = await axiosClient.get<GigaredSummary>(`${BASE}/summary`);
    return r.data;
  },

  async listAccounts(filter: ListAccountsFilter = {}): Promise<ListAccountsResult> {
    const r = await axiosClient.get<ListAccountsResult>(`${BASE}/accounts`, {
      params: toAccountsParams(filter),
    });
    return r.data;
  },

  async getCustomerAccount(customerId: string): Promise<CustomerAccountResult> {
    const r = await axiosClient.get<CustomerAccountResult>(`${BASE}/customers/${customerId}/account`);
    return r.data;
  },

  async linkCic(customerId: string, body: LinkCicPayload): Promise<LinkCicResult> {
    const r = await axiosClient.post<LinkCicResult>(
      `${BASE}/customers/${customerId}/link`,
      body,
    );
    return r.data;
  },

  async registerAccount(
    customerId: string,
    body: RegisterAccountPayload,
  ): Promise<RegisterAccountResult> {
    const r = await axiosClient.post<RegisterAccountResult>(
      `${BASE}/customers/${customerId}/register`,
      body,
    );
    return r.data;
  },

  async addService(customerId: string, body: AddTvServicePayload): Promise<AddTvServiceResult> {
    const r = await axiosClient.post<AddTvServiceResult>(
      `${BASE}/customers/${customerId}/services`,
      body,
    );
    return r.data;
  },

  async removeService(
    customerId: string,
    serviceId: string,
    contractId: string,
  ): Promise<RemoveTvServiceResult> {
    const r = await axiosClient.delete<RemoveTvServiceResult>(
      `${BASE}/customers/${customerId}/services/${serviceId}`,
      { params: { contractId } },
    );
    return r.data;
  },

  // #65 — change the TV account password. The BE resolves the customer's own account server-side
  // (H1: NO cic in the body), PATCHes Gigared and persists the new value on the local TV slot
  // (best-effort: result.persisted). 400 VALIDATION_ERROR if the password breaks the CUA rule.
  async changeTvPassword(
    customerId: string,
    body: ChangeTvPasswordPayload,
  ): Promise<ChangeTvPasswordResult> {
    const r = await axiosClient.post<ChangeTvPasswordResult>(
      `${BASE}/customers/${customerId}/tv-password`,
      body,
    );
    return r.data;
  },

  // #65 fix wave H3 — read the TV credentials from the dedicated, guarded endpoint. The password
  // no longer rides on the contracts list; the "Credenciales Gigared Play" section calls this.
  async getTvCredentials(customerId: string): Promise<TvCredentials> {
    const r = await axiosClient.get<TvCredentials>(`${BASE}/customers/${customerId}/tv-credentials`);
    return r.data;
  },

  async setOtt(customerId: string, body: SetOttPayload): Promise<{ ok: true }> {
    const r = await axiosClient.put<{ ok: true }>(`${BASE}/customers/${customerId}/ott`, body);
    return r.data;
  },

  // #10 — async dar de baja TV: POST → 202 {status:'pending'} (cancel queued on the BE).
  // 409 {queued:false,reason:'already-running'} if already running.
  // Returns { status, data } so the caller can detect 202 vs error shapes.
  async cancelTv(
    customerId: string,
    body: CancelTvPayload,
  ): Promise<{ status: number; data: { status: 'pending' } | CancelTvResult }> {
    const r = await axiosClient.post<{ status: 'pending' } | CancelTvResult>(
      `${BASE}/customers/${customerId}/cancel`,
      body,
    );
    return { status: r.status, data: r.data };
  },

  // #10 — poll the async cancel job status.
  // GET /gigared/customers/:id/cancel/status → CancelStatusResult
  async getCancelStatus(customerId: string): Promise<CancelStatusResult> {
    const r = await axiosClient.get<CancelStatusResult>(
      `${BASE}/customers/${customerId}/cancel/status`,
    );
    return r.data;
  },

  // #5 FE — TV activation history (per-operator / per-client / date range).
  // GET /gigared/customers/activation-history → TvActivationEvent[] (newest first).
  async getActivationHistory(filter: ActivationHistoryFilter = {}): Promise<TvActivationEvent[]> {
    const params: Record<string, string> = {};
    if (filter.actorId) params.actorId = filter.actorId;
    if (filter.customerId) params.customerId = filter.customerId;
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;
    const r = await axiosClient.get<TvActivationEvent[]>(
      `${BASE}/customers/activation-history`,
      { params },
    );
    return r.data;
  },
};
