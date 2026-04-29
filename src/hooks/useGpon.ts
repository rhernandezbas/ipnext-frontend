import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axios-client';
import * as api from '@/api/gpon.api';

export function useOlts() {
  return useQuery({ queryKey: ['gpon-olts'], queryFn: () => api.getOlts() });
}

export function useOnus(oltId?: string) {
  return useQuery({
    queryKey: ['gpon-onus', oltId],
    queryFn: () => api.getOnus(oltId),
  });
}

export function useCreateOlt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; ip: string; model: string; location: string }) =>
      axiosClient.post('/gpon/olts', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gpon-olts'] }),
  });
}

export function useCreateOnu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { serial: string; model: string; oltId: number; port: number; customerId?: number; customerName?: string }) =>
      axiosClient.post('/gpon/onus', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gpon-onus'] }),
  });
}

export function useUpdateOnuStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      axiosClient.patch(`/gpon/onus/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gpon-onus'] }),
  });
}
