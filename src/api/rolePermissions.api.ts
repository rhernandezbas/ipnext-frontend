import axiosClient from './axios-client';
import type { RolePermissionsResponse } from '@/types/rolePermissions';

const base = (roleId: string) => `/admin/rbac/roles/${roleId}/permissions`;

export const rolePermissionsApi = {
  get: (roleId: string): Promise<string[]> =>
    axiosClient
      .get<RolePermissionsResponse>(base(roleId))
      .then(r => r.data.permissionIds),

  set: (roleId: string, permissionIds: string[]): Promise<string[]> =>
    axiosClient
      .put<RolePermissionsResponse>(base(roleId), { permissionIds })
      .then(r => r.data.permissionIds),
};
