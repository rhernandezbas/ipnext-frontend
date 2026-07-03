/**
 * useAssignableOperators — single source of truth for the Recaptación assignee
 * pool. Wraps useRbacUsers and applies the SAME predicate used by every assignee
 * select on the page.
 *
 * recapture-assignable-roles: the pool is now every ACTIVE user WITH at least
 * one role AND none of them technical (`tecnico`). `noc` DOES qualify; a user
 * with NO roles does NOT.
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
const NOC_ROLE: RbacRoleDto = { id: 'role-noc', code: 'noc', label: 'NOC', isSystem: true };
const TECNICO_ROLE: RbacRoleDto = { id: 'role-tec', code: 'tecnico', label: 'Técnico', isSystem: true };

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
  it('U1 — keeps active users with ANY non-technical role (ventas, administrador, noc)', () => {
    mockRbac([
      user({ id: 'op-v', name: 'Ventas Activo', status: 'active', roles: [VENTAS_ROLE] }),
      user({ id: 'op-a', name: 'Admin Activo', status: 'active', roles: [ADMIN_ROLE] }),
      user({ id: 'op-n', name: 'NOC Activo', status: 'active', roles: [NOC_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([
      { id: 'op-v', name: 'Ventas Activo' },
      { id: 'op-a', name: 'Admin Activo' },
      { id: 'op-n', name: 'NOC Activo' },
    ]);
  });

  it('U2 — includes noc (only tecnico is excluded, noc DOES qualify)', () => {
    mockRbac([
      user({ id: 'op-noc', name: 'Operador NOC', status: 'active', roles: [NOC_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-noc', name: 'Operador NOC' }]);
  });

  it('U3 — excludes an active user whose only role is tecnico', () => {
    mockRbac([
      user({ id: 'op-tec', name: 'Técnico', status: 'active', roles: [TECNICO_ROLE] }),
      user({ id: 'op-v', name: 'Ventas', status: 'active', roles: [VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-v', name: 'Ventas' }]);
  });

  it('U4 — excludes a multi-role user that includes tecnico', () => {
    mockRbac([
      user({ id: 'op-mix', name: 'Ventas + Técnico', status: 'active', roles: [VENTAS_ROLE, TECNICO_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([]);
  });

  it('U5 — excludes an ACTIVE user with NO roles', () => {
    mockRbac([
      user({ id: 'op-none', name: 'Sin Roles', status: 'active', roles: [] }),
      user({ id: 'op-v', name: 'Ventas', status: 'active', roles: [VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-v', name: 'Ventas' }]);
  });

  it('U6 — excludes disabled users even when they carry a valid role', () => {
    mockRbac([
      user({ id: 'op-off', name: 'Ventas Baja', status: 'disabled', roles: [VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([]);
  });

  it('U7 — guards against a user with missing roles (roles undefined) without throwing', () => {
    mockRbac([
      // BE could theoretically return a user without the roles array.
      user({ id: 'op-norole', name: 'No Roles', status: 'active', roles: undefined as never }),
      user({ id: 'op-v', name: 'Ventas', status: 'active', roles: [VENTAS_ROLE] }),
    ]);

    const { result } = renderHook(() => useAssignableOperators(true));

    expect(result.current.operators).toEqual([{ id: 'op-v', name: 'Ventas' }]);
  });

  it('U8 — tolerates undefined data (query disabled / not yet loaded)', () => {
    mockRbac(undefined, true);

    const { result } = renderHook(() => useAssignableOperators(false));

    expect(result.current.operators).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('U9 — forwards the enabled flag to useRbacUsers', () => {
    mockRbac([]);
    renderHook(() => useAssignableOperators(false));
    expect(useRbacUsers).toHaveBeenCalledWith(false);

    vi.mocked(useRbacUsers).mockClear();
    mockRbac([]);
    renderHook(() => useAssignableOperators(true));
    expect(useRbacUsers).toHaveBeenCalledWith(true);
  });
});
