/**
 * gestion-app — espejo del contrato de `/api/admin/portal-accounts`
 * (permiso `portal.manage`, verificado contra `portalAccountsAdmin.routes.ts`
 * + los use-cases `ListPortalAccounts` / `CreatePortalAccount` /
 * `SetPortalAccountStatus` / `RegeneratePortalPassword` en el backend).
 *
 * El `total` de la respuesta paginada es lo único que consume la PORTADA de
 * "Gestión de App"; la PÁGINA de Usuarios consume `data` completo + el CRUD.
 */

/** Estados posibles de una cuenta del portal (el BE sólo acepta estos dos). */
export type PortalAccountStatus = 'active' | 'disabled';

export interface PortalAccountAdminDto {
  id: string;
  clientId: string;
  clientName: string;
  dni: string;
  status: PortalAccountStatus;
  lastLoginAt: string | null;
}

export interface PortalAccountListDto {
  data: PortalAccountAdminDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Crear cuenta / regenerar contraseña devuelven la cuenta MÁS la contraseña en
 * texto plano — el BE la muestra UNA sola vez (nunca la vuelve a exponer). La
 * UI la revela una vez y avisa que no se puede recuperar.
 */
export interface PortalAccountWithPasswordDto extends PortalAccountAdminDto {
  password: string;
}

export interface CreatePortalAccountInput {
  clientId: string;
  dni: string;
}

export interface SetPortalAccountStatusInput {
  id: string;
  status: PortalAccountStatus;
}
