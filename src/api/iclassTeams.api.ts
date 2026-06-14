import axiosClient from './axios-client';
import type { IClassTeam, IClassTeamSyncResult } from '@/types/iclassTeam';

const BASE = '/admin/iclass/teams';

export const iclassTeamsApi = {
  list: () =>
    axiosClient
      .get<{ items: IClassTeam[] }>(BASE)
      .then(r => r.data.items),

  sync: () =>
    axiosClient
      .post<IClassTeamSyncResult>(`${BASE}/sync`)
      .then(r => r.data),
};
