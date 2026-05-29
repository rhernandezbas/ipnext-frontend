import type { ReactNode } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { NoPermissionPage } from './NoPermissionPage';

interface RequirePermissionProps {
  /**
   * The permission string required to render `children`.
   * Supports the `*` sentinel (super_admin always passes).
   */
  permission: string;
  /** Rendered while the permissions query is loading. Defaults to null. */
  loadingFallback?: ReactNode;
  /** The protected content to render when access is granted. */
  children: ReactNode;
}

/**
 * Page-level guard component.
 *
 * - While loading  → renders `loadingFallback` (default: null / skeleton)
 * - On error       → renders `<NoPermissionPage>` (fail-safe deny)
 * - Denied         → renders `<NoPermissionPage>`
 * - Allowed        → renders `children`
 *
 * @example
 * <RequirePermission permission="scheduling.read">
 *   <SchedulingPage />
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  loadingFallback = null,
  children,
}: RequirePermissionProps) {
  const { can, isLoading, isError } = useMyPermissions();

  if (isLoading) return <>{loadingFallback}</>;
  if (isError || !can(permission)) return <NoPermissionPage />;

  return <>{children}</>;
}
