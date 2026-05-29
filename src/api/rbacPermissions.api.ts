import axiosClient from './axios-client';
import type { RbacPermissionCatalogResponse, RbacPermissionDto } from '@/types/rolePermissions';

const BASE = '/admin/rbac/permissions';

export const rbacPermissionsApi = {
  list: (): Promise<RbacPermissionDto[]> =>
    axiosClient
      .get<RbacPermissionCatalogResponse>(BASE)
      .then(r => r.data.permissions),
};
