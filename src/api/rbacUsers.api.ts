import axiosClient from './axios-client';
import type { RbacUserWithRolesDto, RbacUserDto, CreateRbacUserPayload, UpdateRbacUserPayload, ChangeRbacUserPasswordPayload } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

export interface UnlockRbacUserResponse {
  user: RbacUserDto;
}

const BASE = '/admin/rbac/users';

export const rbacUsersApi = {
  list: (): Promise<RbacUserWithRolesDto[]> =>
    axiosClient.get<{ users: RbacUserWithRolesDto[] }>(BASE).then(r => r.data.users),

  get: (id: string): Promise<RbacUserWithRolesDto> =>
    axiosClient.get<{ user: RbacUserWithRolesDto }>(`${BASE}/${id}`).then(r => r.data.user),

  create: (payload: CreateRbacUserPayload): Promise<RbacUserWithRolesDto> =>
    axiosClient.post<{ user: RbacUserWithRolesDto }>(BASE, payload).then(r => r.data.user),

  update: (id: string, payload: UpdateRbacUserPayload): Promise<RbacUserDto> =>
    axiosClient.patch<{ user: RbacUserDto }>(`${BASE}/${id}`, payload).then(r => r.data.user),

  delete: (id: string): Promise<void> =>
    axiosClient.delete(`${BASE}/${id}`).then(() => undefined),

  changePassword: (id: string, payload: ChangeRbacUserPasswordPayload): Promise<void> =>
    axiosClient.post(`${BASE}/${id}/password`, payload).then(() => undefined),

  setRoles: (id: string, roleIds: string[]): Promise<RbacRoleDto[]> =>
    axiosClient.put<{ roles: RbacRoleDto[] }>(`${BASE}/${id}/roles`, { roleIds }).then(r => r.data.roles),

  assignRole: (id: string, roleId: string): Promise<void> =>
    axiosClient.post(`${BASE}/${id}/roles`, { roleId }).then(() => undefined),

  removeRole: (id: string, roleId: string): Promise<void> =>
    axiosClient.delete(`${BASE}/${id}/roles/${roleId}`).then(() => undefined),

  unlock: (id: string): Promise<UnlockRbacUserResponse> =>
    axiosClient.post<UnlockRbacUserResponse>(`${BASE}/${id}/unlock`, undefined).then(r => r.data),
};
