import axiosClient from './axios-client';
import type { RbacRoleDto, CreateRbacRolePayload } from '@/types/rbacRole';

const BASE = '/admin/rbac/roles';

export const rbacRolesApi = {
  list: (): Promise<RbacRoleDto[]> =>
    axiosClient.get<{ roles: RbacRoleDto[] }>(BASE).then(r => r.data.roles),

  create: (payload: CreateRbacRolePayload): Promise<RbacRoleDto> =>
    axiosClient.post<{ role: RbacRoleDto }>(BASE, payload).then(r => r.data.role),

  delete: (id: string): Promise<void> =>
    axiosClient.delete(`${BASE}/${id}`).then(() => undefined),
};
