import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rbacUsersApi } from '@/api/rbacUsers.api';
import type { CreateRbacUserPayload, UpdateRbacUserPayload, ChangeRbacUserPasswordPayload } from '@/types/rbacUser';

const LIST_KEY = ['rbac', 'users'] as const;

/**
 * Lists every RBAC user (admins + agents). Backs the recaptación assignee
 * dropdowns (single + bulk), since `operatorId` is validated against `RbacUser`
 * on the BE — NOT the `Admin` table.
 *
 * `enabled` gates the request: GET /admin/rbac/users requires the admin/rbac
 * permission, so a plain agent (who can read recaptación but not assign) must
 * NOT fire it. Callers pass their `recapture.assign` flag. Defaults to `true`
 * to preserve existing call sites.
 */
export function useRbacUsers(enabled = true) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: rbacUsersApi.list,
    staleTime: 30_000,
    enabled,
  });
}

export function useRbacUser(id: string) {
  return useQuery({
    queryKey: [...LIST_KEY, id],
    queryFn: () => rbacUsersApi.get(id),
    staleTime: 60_000,
    enabled: Boolean(id),
  });
}

export function useCreateRbacUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRbacUserPayload) => rbacUsersApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateRbacUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRbacUserPayload }) =>
      rbacUsersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useDeleteRbacUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacUsersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useChangeRbacUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChangeRbacUserPasswordPayload }) =>
      rbacUsersApi.changePassword(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      rbacUsersApi.setRoles(userId, roleIds),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: [...LIST_KEY, userId] });
    },
  });
}

export function useAssignRoleToUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rbacUsersApi.assignRole(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useRemoveRoleFromUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rbacUsersApi.removeRole(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUnlockRbacUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacUsersApi.unlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
