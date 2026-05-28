import axiosClient from './axios-client';
import type { IClassSoType, IClassSoTypeSyncResult } from '@/types/iclassSoType';

const BASE = '/admin/iclass/so-types';

export const iclassSoTypesApi = {
  list: (active?: boolean) =>
    axiosClient
      .get<{ items: IClassSoType[] }>(BASE, {
        params: active !== undefined ? { active: String(active) } : undefined,
      })
      .then(r => r.data.items),
  sync: () =>
    axiosClient.post<IClassSoTypeSyncResult>(`${BASE}/sync`).then(r => r.data),
};
