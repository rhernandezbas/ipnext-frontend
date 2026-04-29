import { useQuery } from '@tanstack/react-query';
import type { SlaStats, SlaContract } from '@/types/sla';
import * as api from '@/api/sla.api';

export function useSlaStats() {
  return useQuery<SlaStats>({ queryKey: ['sla-stats'], queryFn: api.getSlaStats });
}

export function useSlaContracts() {
  return useQuery<SlaContract[]>({ queryKey: ['sla-contracts'], queryFn: api.getSlaContracts });
}
