import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axios-client';
import type { AdminProfile } from '@/types/profile';

export function useProfile() {
  return useQuery<AdminProfile>({
    queryKey: ['profile'],
    queryFn: () => axiosClient.get('/profile').then(r => r.data),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminProfile>) =>
      axiosClient.patch('/profile', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      axiosClient.patch('/profile/password', { currentPassword, newPassword }).then(r => r.data),
  });
}

export function useToggle2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      axiosClient.patch('/profile/2fa', { enabled }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
