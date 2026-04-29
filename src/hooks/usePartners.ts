import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Partner } from '@/types/partner';
import * as api from '@/api/partner.api';

export function usePartners() {
  return useQuery({ queryKey: ['partners'], queryFn: api.getPartners });
}

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPartner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Partner> }) => api.updatePartner(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePartner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  });
}
