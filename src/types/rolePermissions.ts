/** A single permission entry from the catalog. */
export interface RbacPermissionDto {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleLabel: string;
  action: string;
}

/** Catalog response: GET /api/admin/rbac/permissions */
export interface RbacPermissionCatalogResponse {
  permissions: RbacPermissionDto[];
}

/** Grouped view of the catalog — one entry per module. */
export interface PermissionModule {
  moduleId: string;
  moduleCode: string;
  moduleLabel: string;
  /** All actions available in this module, sorted (base actions first, then alpha). */
  actions: string[];
  /** Map of action → permissionId for quick lookup. */
  actionToId: Record<string, string>;
}

/** Role permissions response: GET /api/admin/rbac/roles/:id/permissions */
export interface RolePermissionsResponse {
  permissionIds: string[];
}

/** Payload for PUT /api/admin/rbac/roles/:id/permissions */
export interface SetRolePermissionsPayload {
  permissionIds: string[];
}

/** Error codes from the role-permissions endpoints. */
export type RolePermissionsErrorCode =
  | 'SUPER_ADMIN_IMMUTABLE'
  | 'INVALID_PERMISSION_IDS'
  | 'ROLE_NOT_FOUND';
