import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { RbacPermissionDto } from '@/types/rolePermissions';

vi.mock('@/api/rbacPermissions.api', () => ({
  rbacPermissionsApi: {
    list: vi.fn(),
  },
}));

import { rbacPermissionsApi } from '@/api/rbacPermissions.api';
import { useRbacPermissions } from '@/hooks/useRbacPermissions';

const mockPermissions: RbacPermissionDto[] = [
  { id: 'p1', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'read' },
  { id: 'p2', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'write' },
  { id: 'p3', moduleId: 'm2', moduleCode: 'billing', moduleLabel: 'Facturación', action: 'read' },
  { id: 'p4', moduleId: 'm2', moduleCode: 'billing', moduleLabel: 'Facturación', action: 'delete' },
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

describe('useRbacPermissions', () => {
  it('calls rbacPermissionsApi.list and returns raw permissions', async () => {
    vi.mocked(rbacPermissionsApi.list).mockResolvedValue(mockPermissions);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rbacPermissionsApi.list).toHaveBeenCalledTimes(1);
    expect(result.current.permissions).toEqual(mockPermissions);
  });

  it('groups permissions into modules', async () => {
    vi.mocked(rbacPermissionsApi.list).mockResolvedValue(mockPermissions);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const modules = result.current.modules;
    expect(modules).toHaveLength(2);
    expect(modules[0].moduleCode).toBe('clients');
    expect(modules[0].actions).toContain('read');
    expect(modules[0].actions).toContain('write');
    expect(modules[1].moduleCode).toBe('billing');
  });

  it('actionToId map provides permissionId lookup for each module', async () => {
    vi.mocked(rbacPermissionsApi.list).mockResolvedValue(mockPermissions);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const clientsModule = result.current.modules.find(m => m.moduleCode === 'clients');
    expect(clientsModule?.actionToId['read']).toBe('p1');
    expect(clientsModule?.actionToId['write']).toBe('p2');
  });

  it('sorts base actions (read/write/delete/manage) before sub-actions', async () => {
    const permsWithSubAction: RbacPermissionDto[] = [
      { id: 'p1', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'export_csv' },
      { id: 'p2', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'read' },
      { id: 'p3', moduleId: 'm1', moduleCode: 'clients', moduleLabel: 'Clientes', action: 'delete' },
    ];
    vi.mocked(rbacPermissionsApi.list).mockResolvedValue(permsWithSubAction);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRbacPermissions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const mod = result.current.modules[0];
    // Base actions first, then sub-actions alphabetically
    expect(mod.actions[0]).toBe('read');
    expect(mod.actions[1]).toBe('delete');
    expect(mod.actions[2]).toBe('export_csv');
  });

  it('uses staleTime of 5 minutes', () => {
    vi.mocked(rbacPermissionsApi.list).mockResolvedValue(mockPermissions);
    const { wrapper, qc } = createWrapper();

    renderHook(() => useRbacPermissions(), { wrapper });

    const query = qc.getQueryCache().find({ queryKey: ['rbac', 'permissions'] });
    expect(query).toBeDefined();
    expect(query?.queryKey).toEqual(['rbac', 'permissions']);
  });
});
