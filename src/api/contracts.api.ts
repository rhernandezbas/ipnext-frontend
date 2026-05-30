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

export async function listContracts(
  params: ContractsQuery = {},
): Promise<PaginatedResponse<ContractSummary>> {
  const response = await axiosClient.get<PaginatedResponse<ContractSummary>>(
    '/services',
    { params },
  );
  return response.data;
}
