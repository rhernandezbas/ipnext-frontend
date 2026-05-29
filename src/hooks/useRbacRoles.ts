import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rbacRolesApi } from '@/api/rbacRoles.api';
import type { CreateRbacRolePayload } from '@/types/rbacRole';

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

/** Re-export for consumers that need the payload type without importing from types/ directly. */
export type { CreateRbacRolePayload };

/** Creates a new custom role. Invalidates the roles list on success. */
export function useCreateRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRbacRolePayload) => rbacRolesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Deletes a custom role by ID. Invalidates the roles list on success. */
export function useDeleteRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => rbacRolesApi.delete(roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
