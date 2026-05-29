import type { ReactNode } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';

type CanMode = 'any' | 'all';

interface CanProps {
  /** Single permission string to check. */
  permission?: string;
  /** Multiple permissions to check (use with `mode`). */
  permissions?: string[];
  /** How to evaluate multiple permissions: 'any' (default) or 'all'. */
  mode?: CanMode;
  /** Rendered when the check passes. */
  children: ReactNode;
  /** Rendered when the check fails OR while loading. Defaults to null. */
  fallback?: ReactNode;
}

/**
 * Render-guard component. Renders `children` when the current user holds the
 * required permission(s). Renders `fallback` (default: null) while loading or
 * when access is denied.
 *
 * @example
 * <Can permission="scheduling.delete">
 *   <DeleteButton />
 * </Can>
 *
 * @example
 * <Can permissions={['a', 'b']} mode="all" fallback={<NoAccess />}>
 *   <AdminPanel />
 * </Can>
 */
export function Can({ permission, permissions, mode = 'any', children, fallback = null }: CanProps) {
  const { can, isLoading } = useMyPermissions();

  if (isLoading) return <>{fallback}</>;

  const permsToCheck = permissions ?? (permission ? [permission] : []);

  const granted = can(permsToCheck, mode);

  return granted ? <>{children}</> : <>{fallback}</>;
}
