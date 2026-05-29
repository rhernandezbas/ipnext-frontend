import type { SystemRoleCode } from '@/types/rbacRole';
import type { RbacRoleDto } from '@/types/rbacRole';

/**
 * Badge color class names for system roles.
 * These map to CSS classes defined in the consuming component's CSS module
 * (e.g. RbacUsersBody.module.css) since variables.css has no role-* tokens.
 * Custom roles (isSystem: false) always use 'role-custom'.
 */
export interface RoleDisplayMeta {
  label: string;
  badgeClass: string;
}

export const SYSTEM_ROLE_META: Record<SystemRoleCode, RoleDisplayMeta> = {
  super_admin:    { label: 'Super Administrador', badgeClass: 'role-super-admin' },
  administrador:  { label: 'Administrador',       badgeClass: 'role-administrador' },
  administracion: { label: 'Administración',      badgeClass: 'role-administracion' },
  ventas:         { label: 'Ventas',              badgeClass: 'role-ventas' },
  noc:            { label: 'NOC',                 badgeClass: 'role-noc' },
  tecnico:        { label: 'Técnico',             badgeClass: 'role-tecnico' },
};

/** Returns human label + badge class for any role (system or custom). */
export function roleDisplay(role: RbacRoleDto): RoleDisplayMeta {
  if (role.isSystem && role.code in SYSTEM_ROLE_META) {
    return SYSTEM_ROLE_META[role.code as SystemRoleCode];
  }
  return { label: role.label, badgeClass: 'role-custom' };
}
