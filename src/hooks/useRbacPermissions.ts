import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { rbacPermissionsApi } from '@/api/rbacPermissions.api';
import type { PermissionModule, RbacPermissionDto } from '@/types/rolePermissions';

export const RBAC_PERMISSIONS_QUERY_KEY = ['rbac', 'permissions'] as const;

/** Base RBAC actions rendered in fixed order before sub-actions. */
const BASE_ACTION_ORDER = ['read', 'write', 'delete', 'manage'];

function sortActions(actions: string[]): string[] {
  const base = actions.filter(a => BASE_ACTION_ORDER.includes(a));
  const sub = actions.filter(a => !BASE_ACTION_ORDER.includes(a)).sort();

  base.sort((a, b) => BASE_ACTION_ORDER.indexOf(a) - BASE_ACTION_ORDER.indexOf(b));
  return [...base, ...sub];
}

function groupIntoModules(permissions: RbacPermissionDto[]): PermissionModule[] {
  const map = new Map<string, PermissionModule>();

  for (const perm of permissions) {
    if (!map.has(perm.moduleCode)) {
      map.set(perm.moduleCode, {
        moduleId: perm.moduleId,
        moduleCode: perm.moduleCode,
        moduleLabel: perm.moduleLabel,
        actions: [],
        actionToId: {},
      });
    }
    const mod = map.get(perm.moduleCode)!;
    mod.actions.push(perm.action);
    mod.actionToId[perm.action] = perm.id;
  }

  // Sort actions within each module
  for (const mod of map.values()) {
    mod.actions = sortActions(mod.actions);
  }

  return Array.from(map.values());
}

export interface UseRbacPermissionsResult {
  permissions: RbacPermissionDto[];
  modules: PermissionModule[];
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Fetches the full RBAC permission catalog.
 * staleTime = 5 min (permissions are defined at deploy time, rarely change).
 */
export function useRbacPermissions(): UseRbacPermissionsResult {
  const { data, isLoading, isSuccess, isError } = useQuery({
    queryKey: RBAC_PERMISSIONS_QUERY_KEY,
    queryFn: rbacPermissionsApi.list,
    staleTime: 5 * 60_000,
  });

  const permissions = data ?? [];

  const modules = useMemo(() => groupIntoModules(permissions), [permissions]);

  return { permissions, modules, isLoading, isSuccess, isError };
}
