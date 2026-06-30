import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { rbacUsersApi } from '@/api/rbacUsers.api';

const mockRole: RbacRoleDto = { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true };
const mockUser: RbacUserWithRolesDto = {
  id: 'u1',
  name: 'John Doe',
  email: 'john@example.com',
  login: 'johndoe',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastLoginAt: null,
  lockedUntil: null,
  roles: [mockRole],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rbacUsersApi.list', () => {
  it('GETs /admin/rbac/users and returns the users array', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { users: [mockUser] } });

    const result = await rbacUsersApi.list();

    expect(axiosClient.get).toHaveBeenCalledWith('/admin/rbac/users');
    expect(result).toEqual([mockUser]);
  });
});

describe('rbacUsersApi.get', () => {
  it('GETs /admin/rbac/users/:id and returns the user', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { user: mockUser } });

    const result = await rbacUsersApi.get('u1');

    expect(axiosClient.get).toHaveBeenCalledWith('/admin/rbac/users/u1');
    expect(result).toEqual(mockUser);
  });
});

describe('rbacUsersApi.create', () => {
  it('POSTs /admin/rbac/users with payload and returns created user', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { user: mockUser } });

    const payload = { name: 'John', email: 'john@example.com', login: 'johndoe', password: 'secret123', roleIds: ['r1'] };
    const result = await rbacUsersApi.create(payload);

    expect(axiosClient.post).toHaveBeenCalledWith('/admin/rbac/users', payload);
    expect(result).toEqual(mockUser);
  });
});

describe('rbacUsersApi.update', () => {
  it('PATCHes /admin/rbac/users/:id with partial payload and returns user', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { user: mockUser } });

    const payload = { name: 'Jane' };
    const result = await rbacUsersApi.update('u1', payload);

    expect(axiosClient.patch).toHaveBeenCalledWith('/admin/rbac/users/u1', payload);
    expect(result).toEqual(mockUser);
  });
});

describe('rbacUsersApi.delete', () => {
  it('DELETEs /admin/rbac/users/:id', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });

    await rbacUsersApi.delete('u1');

    expect(axiosClient.delete).toHaveBeenCalledWith('/admin/rbac/users/u1');
  });
});

describe('rbacUsersApi.changePassword', () => {
  it('POSTs /admin/rbac/users/:id/password with newPassword', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    await rbacUsersApi.changePassword('u1', { newPassword: 'newpass123' });

    expect(axiosClient.post).toHaveBeenCalledWith('/admin/rbac/users/u1/password', { newPassword: 'newpass123' });
  });
});

describe('rbacUsersApi.setRoles', () => {
  it('PUTs /admin/rbac/users/:id/roles with roleIds and returns roles array', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: { roles: [mockRole] } });

    const result = await rbacUsersApi.setRoles('u1', ['r1']);

    expect(axiosClient.put).toHaveBeenCalledWith('/admin/rbac/users/u1/roles', { roleIds: ['r1'] });
    expect(result).toEqual([mockRole]);
  });
});

describe('rbacUsersApi.assignRole', () => {
  it('POSTs /admin/rbac/users/:id/roles with roleId', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    await rbacUsersApi.assignRole('u1', 'r1');

    expect(axiosClient.post).toHaveBeenCalledWith('/admin/rbac/users/u1/roles', { roleId: 'r1' });
  });
});

describe('rbacUsersApi.removeRole', () => {
  it('DELETEs /admin/rbac/users/:id/roles/:roleId', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });

    await rbacUsersApi.removeRole('u1', 'r1');

    expect(axiosClient.delete).toHaveBeenCalledWith('/admin/rbac/users/u1/roles/r1');
  });
});

describe('rbacUsersApi.unlock', () => {
  it('POSTs /admin/rbac/users/:id/unlock (no body) and returns { user }', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { user: mockUser } });

    const result = await rbacUsersApi.unlock('u1');

    expect(axiosClient.post).toHaveBeenCalledWith('/admin/rbac/users/u1/unlock', undefined);
    expect(result).toEqual({ user: mockUser });
  });
});
