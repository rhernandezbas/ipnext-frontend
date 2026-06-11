import axiosClient from './axios-client';
import type {
  GigaredConfig,
  UpdateGigaredConfigPayload,
  GigaredSummary,
  ListAccountsFilter,
  ListAccountsResult,
  CustomerAccountResult,
  GigaredAccount,
  LinkCicPayload,
  RegisterAccountPayload,
  AddTvServicePayload,
  AddTvServiceResult,
  RemoveTvServiceResult,
  SetOttPayload,
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

  async linkCic(customerId: string, body: LinkCicPayload): Promise<{ account: GigaredAccount }> {
    const r = await axiosClient.post<{ account: GigaredAccount }>(
      `${BASE}/customers/${customerId}/link`,
      body,
    );
    return r.data;
  },

  async registerAccount(
    customerId: string,
    body: RegisterAccountPayload,
  ): Promise<{ account: GigaredAccount }> {
    const r = await axiosClient.post<{ account: GigaredAccount }>(
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

  async setOtt(customerId: string, body: SetOttPayload): Promise<{ ok: true }> {
    const r = await axiosClient.put<{ ok: true }>(`${BASE}/customers/${customerId}/ott`, body);
    return r.data;
  },
};
