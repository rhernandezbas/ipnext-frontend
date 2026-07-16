import axiosClient from './axios-client';
import type { ContractSummary } from '@/types/contract';
import type { PaginatedResponse } from '@/types/api';

export interface ContractsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  technology?: string;
}

export interface ContractStats {
  total: number;
  byStatus: Record<string, number>;
}

export async function listContracts(
  params: ContractsQuery = {},
): Promise<PaginatedResponse<ContractSummary>> {
  const response = await axiosClient.get<PaginatedResponse<ContractSummary>>(
    '/contracts',
    { params },
  );
  return response.data;
}

export async function getContractStats(): Promise<ContractStats> {
  const response = await axiosClient.get<ContractStats>('/contracts/stats');
  return response.data;
}

/**
 * contract-node-ap-auto-assign (Fase B, picker manual) — payload de
 * PATCH /contracts/:id/network-assignment. `undefined` = no tocar ese campo;
 * `null` = limpiar explícitamente (design §9.1). `networkSiteId: null` limpia AMBOS.
 */
export interface SetContractNetworkAssignmentPayload {
  networkSiteId?: string | null;
  accessPointId?: string | null;
}

export interface ContractNetworkAssignmentResult {
  id: string;
  networkSiteId: string | null;
  accessPointId: string | null;
}

/**
 * PATCH /contracts/:id/network-assignment — picker manual del nodo/AP (gate BE `contracts.assign`).
 * Errores tipados (422): NETWORK_SITE_NOT_FOUND, ACCESS_POINT_NOT_FOUND, ACCESS_POINT_RETIRED,
 * ACCESS_POINT_NOT_IN_SITE — vienen en `err.response.data.code`.
 */
export async function setContractNetworkAssignment(
  contractId: string,
  data: SetContractNetworkAssignmentPayload,
): Promise<ContractNetworkAssignmentResult> {
  const response = await axiosClient.patch<ContractNetworkAssignmentResult>(
    `/contracts/${contractId}/network-assignment`,
    data,
  );
  return response.data;
}
