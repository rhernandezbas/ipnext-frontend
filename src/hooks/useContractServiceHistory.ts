import { useQuery } from '@tanstack/react-query';
import { contractServicesApi } from '@/api/contract-services.api';
import type { ServiceHistoryEntry } from '@/types/customer';

export function useContractServiceHistory(contractId: string, enabled = true) {
  return useQuery<ServiceHistoryEntry[]>({
    queryKey: ['contract-service-history', contractId],
    queryFn: () => contractServicesApi.getHistory(contractId),
    staleTime: 60_000,
    enabled: !!contractId && enabled,
  });
}
