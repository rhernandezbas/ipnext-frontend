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
    '/services',
    { params },
  );
  return response.data;
}

export async function getContractStats(): Promise<ContractStats> {
  const response = await axiosClient.get<ContractStats>('/services/stats');
  return response.data;
}
