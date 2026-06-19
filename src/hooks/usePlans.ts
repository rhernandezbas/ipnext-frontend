import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePlanDto, UpdatePlanDto } from '@/types/plans';
import * as api from '@/api/plans.api';

export const PLANS_QUERY_KEY = ['plans'] as const;

export function usePlans() {
  return useQuery({ queryKey: PLANS_QUERY_KEY, queryFn: api.getPlans });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanDto) => api.createPlan(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS_QUERY_KEY }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanDto }) =>
      api.updatePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS_QUERY_KEY }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS_QUERY_KEY }),
  });
}
