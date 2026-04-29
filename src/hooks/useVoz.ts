import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VoipCategory, VoipPlan } from '@/types/voz';
import * as api from '@/api/voz.api';

export function useVoipCategories() {
  return useQuery({ queryKey: ['voip-categories'], queryFn: api.listVoipCategories });
}

export function useCreateVoipCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<VoipCategory, 'id'>) => api.createVoipCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voip-categories'] }),
  });
}

export function useVoipCdrs() {
  return useQuery({ queryKey: ['voip-cdrs'], queryFn: api.listVoipCdrs });
}

export function useVoipPlans() {
  return useQuery({ queryKey: ['voip-plans'], queryFn: api.listVoipPlans });
}

export function useCreateVoipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<VoipPlan, 'id'>) => api.createVoipPlan(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voip-plans'] }),
  });
}

export function useVoipPrefixes() {
  return useQuery({ queryKey: ['voip-prefixes'], queryFn: api.listVoipPrefixes });
}
