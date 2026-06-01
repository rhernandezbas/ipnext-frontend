import { useQuery } from '@tanstack/react-query';
import { listContracts, type ContractsQuery } from '@/api/contracts.api';

export function useContracts(query: ContractsQuery = {}) {
  return useQuery({
    queryKey: ['contracts', query],
    queryFn: () => listContracts(query),
    staleTime: 30_000,
  });
}
