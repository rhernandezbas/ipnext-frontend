/**
 * gestion-app — espejo del contrato de `GET /api/admin/portal-accounts`
 * (permiso `portal.manage`, verificado contra `ListPortalAccounts` +
 * `portalAccountsAdmin.routes.ts` en el backend). Respuesta PAGINADA: el
 * `total` es lo único que consume la portada de "Gestión de App".
 */
export interface PortalAccountAdminDto {
  id: string;
  clientId: string;
  clientName: string;
  dni: string;
  status: string;
  lastLoginAt: string | null;
}

export interface PortalAccountListDto {
  data: PortalAccountAdminDto[];
  total: number;
  page: number;
  limit: number;
}
