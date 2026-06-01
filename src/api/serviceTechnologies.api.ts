import axiosClient from './axios-client';
import type { ServiceTechnology } from '@/types/serviceTechnology';

const BASE = '/contract-technologies';

export const serviceTechnologiesApi = {
  list: (): Promise<ServiceTechnology[]> =>
    axiosClient.get<ServiceTechnology[]>(BASE).then((r) => r.data),

  getById: (id: string): Promise<ServiceTechnology> =>
    axiosClient.get<ServiceTechnology>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string | null }): Promise<ServiceTechnology> =>
    axiosClient.post<ServiceTechnology>(BASE, data).then((r) => r.data),

  update: (id: string, data: { name?: string; description?: string | null }): Promise<ServiceTechnology> =>
    axiosClient.put<ServiceTechnology>(`${BASE}/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    axiosClient.delete(`${BASE}/${id}`).then(() => undefined),
};
