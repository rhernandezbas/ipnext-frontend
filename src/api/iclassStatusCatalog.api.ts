import axiosClient from './axios-client';
import type {
  IClassStatusCatalogEntry,
  IClassStatusCatalogSyncResult,
  UpdateIClassStatusCatalogPayload,
} from '@/types/iclassStatusCatalog';

const BASE = '/admin/iclass/statuses';

export const iclassStatusCatalogApi = {
  list: () =>
    axiosClient
      .get<{ items: IClassStatusCatalogEntry[] }>(BASE)
      .then(r => r.data.items),

  sync: () =>
    axiosClient
      .post<IClassStatusCatalogSyncResult>(`${BASE}/sync`)
      .then(r => r.data),

  update: (statusCode: string, payload: UpdateIClassStatusCatalogPayload) =>
    axiosClient
      .patch<IClassStatusCatalogEntry>(`${BASE}/${statusCode}`, payload)
      .then(r => r.data),
};
