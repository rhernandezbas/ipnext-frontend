import axiosClient from './axios-client';
import type { ContractService, ServiceHistoryEntry } from '@/types/customer';

export interface AddContractServicePayload {
  serviceCatalogId: string;
  notes?: string | null;
}

export interface UpdateContractServicePayload {
  status?: 'active' | 'inactive';
  notes?: string | null;
  /** Motivo del cambio de estado (registrado en el historial del servicio). */
  reason?: string;
}

/** Service lines on a contract (#43). All ids are UUID strings, used verbatim. */
export const contractServicesApi = {
  add: (contractId: string, payload: AddContractServicePayload) =>
    axiosClient
      .post<ContractService>(`/contracts/${contractId}/services`, payload)
      .then(r => r.data),
  update: (contractId: string, id: string, payload: UpdateContractServicePayload) =>
    axiosClient
      .patch<ContractService>(`/contracts/${contractId}/services/${id}`, payload)
      .then(r => r.data),
  remove: (contractId: string, id: string, reason?: string) =>
    axiosClient.delete(`/contracts/${contractId}/services/${id}`, { data: { reason } }),
  getHistory: (contractId: string): Promise<ServiceHistoryEntry[]> =>
    axiosClient.get<ServiceHistoryEntry[]>(`/contracts/${contractId}/service-history`).then(r => r.data),
};
