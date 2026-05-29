import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { RbacPermissionCatalogResponse } from '@/types/rolePermissions';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { rbacPermissionsApi } from '@/api/rbacPermissions.api';

const mockCatalog: RbacPermissionCatalogResponse = {
  permissions: [
    { id: 'p1', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'read' },
    { id: 'p2', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'write' },
    { id: 'p3', moduleId: 'm2', moduleCode: 'billing', moduleLabel: 'Facturación', action: 'read' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rbacPermissionsApi.list', () => {
  it('GETs /admin/rbac/permissions and returns the permissions array', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockCatalog });

    const result = await rbacPermissionsApi.list();

    expect(axiosClient.get).toHaveBeenCalledWith('/admin/rbac/permissions');
    expect(result).toEqual(mockCatalog.permissions);
  });
});
