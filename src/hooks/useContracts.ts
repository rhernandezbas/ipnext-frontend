import { useQuery } from '@tanstack/react-query';
import { listContracts, getContractStats, type ContractsQuery } from '@/api/contracts.api';

export function useContracts(query: ContractsQuery = {}) {
  return useQuery({
    queryKey: ['contracts', query],
    queryFn: () => listContracts(query),
    staleTime: 30_000,
  });
}

export function useContractStats() {
  return useQuery({
    queryKey: ['contracts', 'stats'],
    queryFn: getContractStats,
    staleTime: 60_000,
  });
}
