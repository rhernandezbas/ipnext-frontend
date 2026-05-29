import axiosClient from './axios-client';
import type { IClassResultCode, IClassResultCodeSyncResult } from '@/types/iclassResultCode';

const BASE = '/admin/iclass/result-codes';

export const iclassResultCodesApi = {
  list: (mapped?: boolean) =>
    axiosClient
      .get<{ items: IClassResultCode[] }>(BASE, {
        params: mapped !== undefined ? { mapped: String(mapped) } : undefined,
      })
      .then(r => r.data.items),
  sync: () =>
    axiosClient.post<IClassResultCodeSyncResult>(`${BASE}/sync`).then(r => r.data),
  assignStage: (id: string, stageId: string | null) =>
    axiosClient.patch<IClassResultCode>(`${BASE}/${id}`, { stageId }).then(r => r.data),
};
