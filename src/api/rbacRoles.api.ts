import axiosClient from './axios-client';
import type { RbacRoleDto } from '@/types/rbacRole';

const BASE = '/admin/rbac/roles';

export const rbacRolesApi = {
  list: (): Promise<RbacRoleDto[]> =>
    axiosClient.get<{ roles: RbacRoleDto[] }>(BASE).then(r => r.data.roles),
};
