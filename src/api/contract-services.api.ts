import axiosClient from './axios-client';
import type { ContractService } from '@/types/customer';

export interface AddContractServicePayload {
  serviceCatalogId: string;
  notes?: string | null;
}

export interface UpdateContractServicePayload {
  status?: 'active' | 'inactive';
  notes?: string | null;
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
  remove: (contractId: string, id: string) =>
    axiosClient.delete(`/contracts/${contractId}/services/${id}`),
};
