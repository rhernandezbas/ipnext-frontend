import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServicePlan } from '@/types/service-plans';
import * as api from '@/api/service-plans.api';

export function useServicePlans() {
  return useQuery({ queryKey: ['service-plans'], queryFn: api.getServicePlans });
}

export function useCreateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useUpdateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServicePlan> }) =>
      api.updateServicePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useDeleteServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}
