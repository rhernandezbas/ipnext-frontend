import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Admin } from '@/types/admin';
import type { AdminRole_Definition } from '@/types/role';
import * as api from '@/api/admin.api';
import * as roleApi from '@/api/role.api';

export function useAdmins() {
  return useQuery({ queryKey: ['admins'], queryFn: api.getAdmins });
}

export function useAdminActivityLog() {
  return useQuery({ queryKey: ['admin-activity-log'], queryFn: api.getActivityLog });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAdmin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Admin> }) => api.updateAdmin(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  });
}

export function useDeleteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAdmin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: roleApi.getRoles });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roleApi.createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminRole_Definition> }) =>
      roleApi.updateRole(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useAdmin2FAStatus(adminId: string) {
  return useQuery({
    queryKey: ['admin-2fa', adminId],
    queryFn: () => api.get2FAStatus(adminId),
    enabled: !!adminId,
  });
}

export function useEnable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ adminId, method }: { adminId: string; method: 'totp' | 'sms' }) =>
      api.enable2FA(adminId, method),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['admin-2fa', vars.adminId] }),
  });
}

export function useDisable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminId: string) => api.disable2FA(adminId),
    onSuccess: (_data, adminId) => qc.invalidateQueries({ queryKey: ['admin-2fa', adminId] }),
  });
}
