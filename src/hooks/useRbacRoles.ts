import { useQuery } from '@tanstack/react-query';
import { rbacRolesApi } from '@/api/rbacRoles.api';

const KEY = ['rbac', 'roles'] as const;

/** Fetches all RBAC roles for use in selectors (role multi-select in RbacUserModal).
 *  staleTime is 5 minutes — roles change very rarely. */
export function useRbacRoles() {
  return useQuery({
    queryKey: KEY,
    queryFn: rbacRolesApi.list,
    staleTime: 300_000,
  });
}
