import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

vi.mock('@/api/rolePermissions.api', () => ({
  rolePermissionsApi: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { rolePermissionsApi } from '@/api/rolePermissions.api';
import { useRolePermissions, useSetRolePermissions } from '@/hooks/useRolePermissions';

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

describe('useRolePermissions', () => {
  it('returns null data when roleId is null (no fetch)', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRolePermissions(null), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(rolePermissionsApi.get).not.toHaveBeenCalled();
  });

  it('fetches permissionIds for a given roleId', async () => {
    vi.mocked(rolePermissionsApi.get).mockResolvedValue(['p1', 'p3']);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRolePermissions('r1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rolePermissionsApi.get).toHaveBeenCalledWith('r1');
    expect(result.current.data).toEqual(['p1', 'p3']);
  });

  it('re-fetches when roleId changes', async () => {
    vi.mocked(rolePermissionsApi.get).mockResolvedValue(['p1']);
    const { wrapper } = createWrapper();
    let roleId = 'r1';

    const { result, rerender } = renderHook(() => useRolePermissions(roleId), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rolePermissionsApi.get).toHaveBeenCalledWith('r1');

    vi.mocked(rolePermissionsApi.get).mockResolvedValue(['p2']);
    roleId = 'r2';
    rerender();

    await waitFor(() => expect(rolePermissionsApi.get).toHaveBeenCalledWith('r2'));
  });
});

describe('useSetRolePermissions', () => {
  it('calls rolePermissionsApi.set with roleId and permissionIds', async () => {
    vi.mocked(rolePermissionsApi.set).mockResolvedValue(['p1', 'p2']);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSetRolePermissions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ roleId: 'r1', permissionIds: ['p1', 'p2'] });
    });

    expect(rolePermissionsApi.set).toHaveBeenCalledWith('r1', ['p1', 'p2']);
  });

  it('invalidates role permissions query on success', async () => {
    vi.mocked(rolePermissionsApi.set).mockResolvedValue(['p1']);
    const { wrapper, qc } = createWrapper();

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetRolePermissions(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ roleId: 'r1', permissionIds: ['p1'] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['rbac', 'roles', 'r1', 'permissions']) })
    );
  });
});
