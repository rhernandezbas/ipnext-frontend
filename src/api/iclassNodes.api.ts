import axiosClient from './axios-client';
import type { IClassNode, IClassNodeSyncResult } from '@/types/iclassNode';

const BASE = '/admin/iclass/nodes';

export interface IClassNodesFilter {
  active?: boolean;
  selectable?: boolean;
}

export const getIClassNodes = (filter: IClassNodesFilter = {}) => {
  const params: Record<string, string> = {};
  if (filter.active !== undefined) params.active = String(filter.active);
  if (filter.selectable !== undefined) params.selectable = String(filter.selectable);
  return axiosClient
    .get<{ items: IClassNode[] }>(BASE, {
      params: Object.keys(params).length > 0 ? params : undefined,
    })
    .then(r => r.data.items);
};

export const syncIClassNodes = () =>
  axiosClient.post<IClassNodeSyncResult>(`${BASE}/sync`).then(r => r.data);
