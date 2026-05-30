import axiosClient from './axios-client';
import type { SessionDto, SessionPage, SessionQuery } from '@/types/session';

const BASE = '/admin/sessions';

export interface SessionHistoryResponse {
  data: SessionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const sessionsApi = {
  list: (query: SessionQuery = {}): Promise<SessionPage> =>
    axiosClient
      .get<SessionPage>(BASE, { params: query })
      .then(r => r.data),

  revoke: (id: string): Promise<void> =>
    axiosClient.post(`${BASE}/${id}/revoke`).then(() => undefined),

  revokeAllForUser: (userId: string): Promise<{ revoked: number }> =>
    axiosClient
      .post<{ revoked: number }>(`${BASE}/user/${userId}/revoke-all`)
      .then(r => r.data),

  getHistory: (page: number, pageSize: number): Promise<SessionHistoryResponse> =>
    axiosClient
      .get<SessionHistoryResponse>(`${BASE}/history`, { params: { page, pageSize } })
      .then(r => r.data),
};
