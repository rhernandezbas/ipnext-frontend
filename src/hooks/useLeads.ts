import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Lead } from '@/types/lead';
import * as api from '@/api/leads.api';

export function useLeads() {
  return useQuery({ queryKey: ['leads'], queryFn: api.getLeads });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => api.updateLead(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useConvertLeadToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId }: { id: string; clientId: string }) =>
      api.convertLeadToClient(id, clientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
