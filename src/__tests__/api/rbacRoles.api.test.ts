import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { RbacRoleDto } from '@/types/rbacRole';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { rbacRolesApi } from '@/api/rbacRoles.api';

const mockRoles: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rbacRolesApi.list', () => {
  it('GETs /admin/rbac/roles and returns the roles array', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { roles: mockRoles } });

    const result = await rbacRolesApi.list();

    expect(axiosClient.get).toHaveBeenCalledWith('/admin/rbac/roles');
    expect(result).toEqual(mockRoles);
  });
});
