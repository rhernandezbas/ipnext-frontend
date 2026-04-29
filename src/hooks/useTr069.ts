import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tr069Profile } from '@/types/tr069';
import * as api from '@/api/tr069.api';

export function useTr069Profiles() {
  return useQuery({ queryKey: ['tr069-profiles'], queryFn: api.getTr069Profiles });
}

export function useCreateTr069Profile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Tr069Profile, 'id'>) => api.createTr069Profile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr069-profiles'] }),
  });
}

export function useUpdateTr069Profile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tr069Profile> }) =>
      api.updateTr069Profile(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr069-profiles'] }),
  });
}

export function useDeleteTr069Profile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTr069Profile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr069-profiles'] }),
  });
}

export function useTr069Devices() {
  return useQuery({ queryKey: ['tr069-devices'], queryFn: api.getTr069Devices });
}

export function useProvisionDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.provisionDevice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr069-devices'] }),
  });
}

export function useDeleteTr069Device() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTr069Device(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr069-devices'] }),
  });
}
