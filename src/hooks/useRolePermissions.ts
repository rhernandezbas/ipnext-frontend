import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolePermissionsApi } from '@/api/rolePermissions.api';

// Keep the query key as a literal here to avoid pulling in the mocked module.
// This MUST stay in sync with ME_PERMISSIONS_QUERY_KEY in useMyPermissions.ts.
const ME_QUERY_KEY = ['auth', 'me'] as const;

const rolePermsKey = (roleId: string) => ['rbac', 'roles', roleId, 'permissions'] as const;

/**
 * Fetches the permission IDs assigned to a specific role.
 * Pass `null` to disable (e.g. no role selected).
 */
export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: roleId ? rolePermsKey(roleId) : ['rbac', 'roles', null, 'permissions'],
    queryFn: () => rolePermissionsApi.get(roleId!),
    enabled: roleId !== null,
    staleTime: 60_000, // 1 min — stale quickly since user can mutate
  });
}

interface SetRolePermissionsVars {
  roleId: string;
  permissionIds: string[];
}

/**
 * Mutation to replace all permissions for a role (PUT endpoint).
 * On success: invalidates the role's permission cache + the caller's own me-permissions.
 */
export function useSetRolePermissions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissionIds }: SetRolePermissionsVars) =>
      rolePermissionsApi.set(roleId, permissionIds),

    onSuccess: (_data, { roleId }) => {
      // Invalidate the specific role's permissions cache
      qc.invalidateQueries({ queryKey: rolePermsKey(roleId) });
      // Invalidate the caller's own permissions (they may hold this role)
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
