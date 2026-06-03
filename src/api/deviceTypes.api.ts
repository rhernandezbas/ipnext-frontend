import axiosClient from './axios-client';
import type { DeviceType } from '@/types/deviceType';

const BASE = '/inventory/device-types';

export const deviceTypesApi = {
  list: () => axiosClient.get<DeviceType[]>(BASE).then(r => r.data),
  create: (data: { name: string; label?: string | null; active?: boolean; sortOrder?: number }) =>
    axiosClient.post<DeviceType>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string; label?: string | null; active?: boolean; sortOrder?: number }) =>
    axiosClient.put<DeviceType>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
