import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { myPermissionsApi } from '@/api/myPermissions.api';
import type { MeUser, MeRole } from '@/types/myPermissions';

export const ME_PERMISSIONS_QUERY_KEY = ['auth', 'me'] as const;

type CanMode = 'any' | 'all';

export interface UseMyPermissionsResult {
  user: MeUser | null;
  roles: MeRole[];
  permissions: string[];
  isLoading: boolean;
  isError: boolean;
  /**
   * Check if the current user has a permission.
   *
   * - `can('scheduling.delete')` — single string check
   * - `can(['scheduling.delete', 'scheduling.bulk_delete'], 'any')` — any match
   * - `can(['scheduling.delete', 'scheduling.bulk_delete'], 'all')` — all must match
   *
   * If the user holds the sentinel `"*"` permission, always returns true.
   */
  can: (permission: string | string[], mode?: CanMode) => boolean;
}

export function useMyPermissions(): UseMyPermissionsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ME_PERMISSIONS_QUERY_KEY,
    queryFn: myPermissionsApi.me,
    staleTime: 5 * 60_000,   // 5 minutes
    gcTime: 30 * 60_000,     // 30 minutes
    refetchOnWindowFocus: false,
  });

  const permissions = data?.permissions ?? [];

  const can = useMemo(() => {
    return (permission: string | string[], mode: CanMode = 'any'): boolean => {
      // super_admin short-circuit
      if (permissions.includes('*')) return true;

      const perms = Array.isArray(permission) ? permission : [permission];

      if (mode === 'all') {
        return perms.every(p => permissions.includes(p));
      }
      // mode === 'any' (default)
      return perms.some(p => permissions.includes(p));
    };
  }, [permissions]);

  return {
    user: data?.user ?? null,
    roles: data?.roles ?? [],
    permissions,
    isLoading,
    isError,
    can,
  };
}

/** Convenience wrapper — returns a boolean for a single permission check. */
export function useCan(permission: string): boolean {
  const { can } = useMyPermissions();
  return can(permission);
}
