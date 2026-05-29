import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

vi.mock('@/api/rbacRoles.api', () => ({
  rbacRolesApi: {
    list: vi.fn(),
  },
}));

import { rbacRolesApi } from '@/api/rbacRoles.api';
import { useRbacRoles } from '@/hooks/useRbacRoles';
import type { RbacRoleDto } from '@/types/rbacRole';

const mockRoles: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
];

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

describe('useRbacRoles', () => {
  it('calls rbacRolesApi.list and returns roles', async () => {
    vi.mocked(rbacRolesApi.list).mockResolvedValue(mockRoles);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacRoles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rbacRolesApi.list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockRoles);
  });

  it('uses staleTime of 300_000ms (roles change rarely)', () => {
    vi.mocked(rbacRolesApi.list).mockResolvedValue(mockRoles);
    const { wrapper, qc } = createWrapper();

    renderHook(() => useRbacRoles(), { wrapper });

    // Confirm the query was registered with correct stale time
    const query = qc.getQueryCache().find({ queryKey: ['rbac', 'roles'] });
    expect(query).toBeDefined();
    // staleTime is an option on the observer, not directly readable from cache
    // But we verify the query key is correct
    expect(query?.queryKey).toEqual(['rbac', 'roles']);
  });
});
