// IMPORTANT: setup.ts applies a global vi.mock for @/hooks/useMyPermissions.
// This test file tests the REAL implementation, so we must unmock it first.
vi.unmock('@/hooks/useMyPermissions');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

vi.mock('@/api/myPermissions.api', () => ({
  myPermissionsApi: {
    me: vi.fn(),
  },
}));

import { myPermissionsApi } from '@/api/myPermissions.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { MeResponse } from '@/types/myPermissions';

const baseMe: MeResponse = {
  user: { id: 'u1', username: 'alice', email: 'alice@example.com', displayName: 'Alice', role: 'admin' },
  roles: [{ id: 'r1', code: 'admin', label: 'Admin', isSystem: true }],
  permissions: ['scheduling.delete', 'scheduling.bulk_delete', 'clients.view'],
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

describe('useMyPermissions', () => {
  it('S1 — success: returns user + roles + permissions + can', async () => {
    vi.mocked(myPermissionsApi.me).mockResolvedValue(baseMe);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(baseMe.user);
    expect(result.current.roles).toEqual(baseMe.roles);
    expect(result.current.permissions).toEqual(baseMe.permissions);
    expect(result.current.isError).toBe(false);
  });

  it('S2 — can(string) returns true when permission is in the list', async () => {
    vi.mocked(myPermissionsApi.me).mockResolvedValue(baseMe);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('scheduling.delete')).toBe(true);
    expect(result.current.can('scheduling.bulk_delete')).toBe(true);
    expect(result.current.can('unknown.perm')).toBe(false);
  });

  it('S3 — sentinel "*": can() always returns true for any permission', async () => {
    const superMe: MeResponse = { ...baseMe, permissions: ['*'] };
    vi.mocked(myPermissionsApi.me).mockResolvedValue(superMe);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('scheduling.delete')).toBe(true);
    expect(result.current.can('some.random.permission')).toBe(true);
    expect(result.current.can('')).toBe(true);
  });

  it('S4 — loading state: isLoading=true while pending, user/roles/permissions are defaults', () => {
    vi.mocked(myPermissionsApi.me).mockReturnValue(new Promise(() => {})); // never resolves
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
  });

  it('S5 — error state: isError=true, user/roles/permissions are defaults', async () => {
    vi.mocked(myPermissionsApi.me).mockRejectedValue(new Error('Network error'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.user).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
  });

  it('S6 — can(array, "any"): returns true when at least one permission matches', async () => {
    vi.mocked(myPermissionsApi.me).mockResolvedValue(baseMe);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can(['scheduling.delete', 'unknown.perm'], 'any')).toBe(true);
    expect(result.current.can(['unknown.a', 'unknown.b'], 'any')).toBe(false);
  });

  it('S7 — can(array, "all"): returns true only when ALL permissions match', async () => {
    vi.mocked(myPermissionsApi.me).mockResolvedValue(baseMe);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can(['scheduling.delete', 'scheduling.bulk_delete'], 'all')).toBe(true);
    expect(result.current.can(['scheduling.delete', 'unknown.perm'], 'all')).toBe(false);
  });
});
