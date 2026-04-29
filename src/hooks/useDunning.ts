import { useQuery } from '@tanstack/react-query';
import type { DunningEntry, PaymentPlan } from '@/types/dunning';
import * as api from '@/api/dunning.api';

export function useDunningEntries() {
  return useQuery<DunningEntry[]>({ queryKey: ['dunning-entries'], queryFn: api.getDunningEntries });
}

export function usePaymentPlans() {
  return useQuery<PaymentPlan[]>({ queryKey: ['payment-plans'], queryFn: api.getPaymentPlans });
}
