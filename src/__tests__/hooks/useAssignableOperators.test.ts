/**
 * useAssignableOperators — single source of truth for the Recaptación assignee
 * pool. Wraps useRbacUsers and applies the SAME predicate used by every assignee
 * select on the page: only ACTIVE users carrying the 'ventas' role qualify.
 *
 * The three selects (inline column, BulkAssignToolbar, LeadDetailDrawer) MUST
 * all read from this hook so the filter can never drift between them again.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the underlying RbacUser query — we only test the filter/map logic here.
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(),
}));

import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useAssignableOperators } from '@/hooks/useAssignableOperators';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

const VENTAS_ROLE: RbacRoleDto = { id: 'role-ventas', code: 'ventas', label: 'Ventas', isSystem: true };
const ADMIN_ROLE: RbacRoleDto = { id: 'role-admin', code: 'administrador', label: 'Administrador', isSystem: true };

function user(over: Partial<RbacUserWithRolesDto>): RbacUserWithRolesDto {
  return {
    id: 'u',
    name: 'User',
    email: 'u@test.com',
    login: 'u',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    lockedUntil: null,
    roles: [VENTAS_ROLE],
    ...over,
  };
}

function mockRbac(data: RbacUserWithRolesDto[] | undefined, isLoading = false) {
  vi.mocked(useRbacUsers).mockReturnValue({
    data,
    isLoading,
    isError: false,
  } as unknown as ReturnType<typeof useRbacUsers>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAssignableOperators', () => {
  it('U1 — keeps only active users WITH the ventas role, mapped to {id,name}', () => {
    mockRbac([
      user({ id: 'op-1', name: 'Ventas Activo', status: 'active', roles: [VENTAS_ROLE] }),
      user({ id: 'op-off', name: 'Ventas Baja', status: 'disabled', roles: [VENTAS_ROLE] }),
      user({ id: 'op-nv', name: 'Sin Ventas', status: 'active', roles: [] }),
      user({ id: 'op-adm', name: 'Admin Solo', status: 'active', roles: [ADMIN_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-1', name: 'Ventas Activo' }]);
  });

  it('U2 — keeps a user that holds ventas ALONGSIDE other roles', () => {
    mockRbac([
      user({ id: 'op-multi', name: 'Multi', status: 'active', roles: [ADMIN_ROLE, VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-multi', name: 'Multi' }]);
  });

  it('U3 — guards against a user with missing roles (roles undefined) without throwing', () => {
    mockRbac([
      // BE could theoretically return a user without the roles array.
      user({ id: 'op-norole', name: 'No Roles', status: 'active', roles: undefined as never }),
      user({ id: 'op-1', name: 'Ventas', status: 'active', roles: [VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-1', name: 'Ventas' }]);
  });

  it('U4 — returns an empty pool when no user qualifies', () => {
    mockRbac([
      user({ id: 'op-adm', name: 'Admin Solo', status: 'active', roles: [ADMIN_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([]);
  });

  it('U5 — tolerates undefined data (query disabled / not yet loaded)', () => {
    mockRbac(undefined, true);

    const { result } = renderHook(() => useAssignableOperators(false));

    expect(result.current.operators).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('U6 — forwards the enabled flag to useRbacUsers', () => {
    mockRbac([]);
    renderHook(() => useAssignableOperators(false));
    expect(useRbacUsers).toHaveBeenCalledWith(false);

    vi.mocked(useRbacUsers).mockClear();
    mockRbac([]);
    renderHook(() => useAssignableOperators(true));
    expect(useRbacUsers).toHaveBeenCalledWith(true);
  });
});
