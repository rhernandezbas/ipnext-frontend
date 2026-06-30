import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock the api module before importing hooks
vi.mock('@/api/rbacUsers.api', () => ({
  rbacUsersApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    changePassword: vi.fn(),
    setRoles: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    unlock: vi.fn(),
  },
}));

import { rbacUsersApi } from '@/api/rbacUsers.api';
import {
  useRbacUsers,
  useRbacUser,
  useCreateRbacUser,
  useUpdateRbacUser,
  useDeleteRbacUser,
  useChangeRbacUserPassword,
  useSetUserRoles,
  useAssignRoleToUser,
  useRemoveRoleFromUser,
  useUnlockRbacUser,
} from '@/hooks/useRbacUsers';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

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

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRbacUsers', () => {
  it('calls rbacUsersApi.list and returns users', async () => {
    vi.mocked(rbacUsersApi.list).mockResolvedValue([mockUser]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rbacUsersApi.list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([mockUser]);
  });
});

describe('useRbacUser', () => {
  it('calls rbacUsersApi.get(id) and returns single user', async () => {
    vi.mocked(rbacUsersApi.get).mockResolvedValue(mockUser);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacUser('u1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rbacUsersApi.get).toHaveBeenCalledWith('u1');
    expect(result.current.data).toEqual(mockUser);
  });
});

describe('useCreateRbacUser', () => {
  it('calls rbacUsersApi.create with payload and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.create).mockResolvedValue(mockUser);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateRbacUser(), { wrapper });

    await result.current.mutateAsync({
      name: 'John',
      email: 'john@example.com',
      login: 'johndoe',
      password: 'secret123',
      roleIds: ['r1'],
    });

    expect(rbacUsersApi.create).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useUpdateRbacUser', () => {
  it('calls rbacUsersApi.update with id + payload and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.update).mockResolvedValue(mockUser);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateRbacUser(), { wrapper });

    await result.current.mutateAsync({ id: 'u1', payload: { name: 'Jane' } });

    expect(rbacUsersApi.update).toHaveBeenCalledWith('u1', { name: 'Jane' });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useDeleteRbacUser', () => {
  it('calls rbacUsersApi.delete with id and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.delete).mockResolvedValue(undefined);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteRbacUser(), { wrapper });

    await result.current.mutateAsync('u1');

    expect(rbacUsersApi.delete).toHaveBeenCalledWith('u1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useChangeRbacUserPassword', () => {
  it('calls rbacUsersApi.changePassword with id + payload', async () => {
    vi.mocked(rbacUsersApi.changePassword).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChangeRbacUserPassword(), { wrapper });

    await result.current.mutateAsync({ id: 'u1', payload: { newPassword: 'newpass123' } });

    expect(rbacUsersApi.changePassword).toHaveBeenCalledWith('u1', { newPassword: 'newpass123' });
  });
});

describe('useSetUserRoles', () => {
  it('calls rbacUsersApi.setRoles and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.setRoles).mockResolvedValue([mockRole]);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetUserRoles(), { wrapper });

    await result.current.mutateAsync({ userId: 'u1', roleIds: ['r1'] });

    expect(rbacUsersApi.setRoles).toHaveBeenCalledWith('u1', ['r1']);
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useAssignRoleToUser', () => {
  it('calls rbacUsersApi.assignRole and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.assignRole).mockResolvedValue(undefined);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useAssignRoleToUser(), { wrapper });

    await result.current.mutateAsync({ userId: 'u1', roleId: 'r1' });

    expect(rbacUsersApi.assignRole).toHaveBeenCalledWith('u1', 'r1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useRemoveRoleFromUser', () => {
  it('calls rbacUsersApi.removeRole and invalidates rbacUsers query', async () => {
    vi.mocked(rbacUsersApi.removeRole).mockResolvedValue(undefined);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRemoveRoleFromUser(), { wrapper });

    await result.current.mutateAsync({ userId: 'u1', roleId: 'r1' });

    expect(rbacUsersApi.removeRole).toHaveBeenCalledWith('u1', 'r1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});

describe('useUnlockRbacUser', () => {
  it('calls rbacUsersApi.unlock with id and invalidates rbacUsers list query', async () => {
    vi.mocked(rbacUsersApi.unlock).mockResolvedValue({ user: mockUser });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUnlockRbacUser(), { wrapper });

    await result.current.mutateAsync('u1');

    expect(rbacUsersApi.unlock).toHaveBeenCalledWith('u1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rbac', 'users'] }));
  });
});
