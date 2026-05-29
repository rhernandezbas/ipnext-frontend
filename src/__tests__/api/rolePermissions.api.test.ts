import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { RolePermissionsResponse } from '@/types/rolePermissions';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { rolePermissionsApi } from '@/api/rolePermissions.api';

const mockPermsResponse: RolePermissionsResponse = {
  permissionIds: ['p1', 'p3'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rolePermissionsApi.get', () => {
  it('GETs /admin/rbac/roles/:id/permissions and returns permissionIds', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockPermsResponse });

    const result = await rolePermissionsApi.get('r1');

    expect(axiosClient.get).toHaveBeenCalledWith('/admin/rbac/roles/r1/permissions');
    expect(result).toEqual(['p1', 'p3']);
  });
});

describe('rolePermissionsApi.set', () => {
  it('PUTs /admin/rbac/roles/:id/permissions with permissionIds payload', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockPermsResponse });

    const result = await rolePermissionsApi.set('r1', ['p1', 'p3']);

    expect(axiosClient.put).toHaveBeenCalledWith('/admin/rbac/roles/r1/permissions', {
      permissionIds: ['p1', 'p3'],
    });
    expect(result).toEqual(['p1', 'p3']);
  });
});
