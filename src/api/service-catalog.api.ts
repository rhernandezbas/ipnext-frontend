import axiosClient from './axios-client';
import type { ServiceCatalogEntry } from '@/types/customer';

const BASE = '/service-catalog';

export interface CreateServiceCatalogPayload {
  name: string;
  label?: string | null;
  sortOrder?: number;
}

export interface PatchServiceCatalogPayload {
  name?: string;
  label?: string | null;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Service catalog ABM (#43). Mirrors `deviceTypes.api` but the catalog route
 * uses PATCH for updates (DeviceTypes uses PUT — do NOT copy that verb).
 */
export const serviceCatalogApi = {
  list: (activeOnly?: boolean) =>
    axiosClient
      .get<ServiceCatalogEntry[]>(BASE, { params: activeOnly ? { active: true } : {} })
      .then(r => r.data),
  create: (data: CreateServiceCatalogPayload) =>
    axiosClient.post<ServiceCatalogEntry>(BASE, data).then(r => r.data),
  patch: (id: string, data: PatchServiceCatalogPayload) =>
    axiosClient.patch<ServiceCatalogEntry>(`${BASE}/${id}`, data).then(r => r.data),
  remove: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
