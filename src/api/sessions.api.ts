import axiosClient from './axios-client';
import type { SessionPage, SessionQuery } from '@/types/session';

const BASE = '/admin/sessions';

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
};
