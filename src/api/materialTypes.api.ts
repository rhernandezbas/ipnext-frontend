import axiosClient from './axios-client';
import type { MaterialType } from '@/types/materialType';

const BASE = '/inventory/material-types';

export const materialTypesApi = {
  list: () => axiosClient.get<MaterialType[]>(BASE).then(r => r.data),
  create: (data: { name: string; label?: string | null; unit?: string | null; active?: boolean; sortOrder?: number }) =>
    axiosClient.post<MaterialType>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string; label?: string | null; unit?: string | null; active?: boolean; sortOrder?: number }) =>
    axiosClient.put<MaterialType>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
