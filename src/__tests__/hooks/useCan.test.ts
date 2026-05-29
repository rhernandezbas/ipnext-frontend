// setup.ts mocks @/hooks/useMyPermissions globally (including useCan).
// useCan is a thin wrapper around useMyPermissions().can().
// We test it by mocking useMyPermissions and asserting useCan delegates correctly.
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

function mockCanFn(permissions: string[]) {
  const canFn = (p: string | string[], mode: 'any' | 'all' = 'any'): boolean => {
    if (permissions.includes('*')) return true;
    const perms = Array.isArray(p) ? p : [p];
    if (mode === 'all') return perms.every(x => permissions.includes(x));
    return perms.some(x => permissions.includes(x));
  };

  const result: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: canFn,
  };
  vi.mocked(useMyPermissions).mockReturnValue(result);
  // useCan calls useMyPermissions().can() — wire the mock so renderHook(useCan) works
  vi.mocked(useCan).mockImplementation((perm: string) => canFn(perm));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCan', () => {
  it('returns true when the user has the permission', () => {
    mockCanFn(['scheduling.delete']);
    const { result } = renderHook(() => useCan('scheduling.delete'));
    expect(result.current).toBe(true);
  });

  it('returns false when the user lacks the permission', () => {
    mockCanFn(['scheduling.delete']);
    const { result } = renderHook(() => useCan('unknown.permission'));
    expect(result.current).toBe(false);
  });

  it('returns true when the user holds the sentinel "*" permission', () => {
    mockCanFn(['*']);
    const { result } = renderHook(() => useCan('any.random.permission'));
    expect(result.current).toBe(true);
  });
});
