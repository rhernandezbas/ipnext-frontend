import axiosClient from './axios-client';
import type {
  PortalAccountAdminDto,
  PortalAccountListDto,
  PortalAccountWithPasswordDto,
  CreatePortalAccountInput,
  PortalAccountStatus,
} from '@/types/portalAccount';

const BASE = '/admin/portal-accounts';

export interface ListPortalAccountsParams {
  page?: number;
  limit?: number;
}

/**
 * Cliente HTTP del CRUD administrativo de cuentas del portal. TODAS las rutas
 * exigen `portal.manage` en el BE (guard granular — "solo autenticado" NO
 * alcanza); el caller debe gatear la UI con ese mismo permiso.
 */
export const portalAccountsApi = {
  /**
   * Listado paginado. El BE capea `limit` en 100 y rechaza cualquier cosa que
   * no sea un entero >= 1 — la portada pide `limit: 1` porque sólo necesita el
   * `total`, no las filas (traer 100 cuentas para mostrar un número sería
   * tirar ancho de banda a la basura). La PÁGINA de Usuarios sí pide las filas.
   */
  list: (params: ListPortalAccountsParams = {}) =>
    axiosClient.get<PortalAccountListDto>(BASE, { params }).then((r) => r.data),

  /**
   * Crear cuenta para un cliente. Devuelve la contraseña generada en texto
   * plano — se muestra UNA vez y no se vuelve a exponer. `201`.
   */
  create: (input: CreatePortalAccountInput) =>
    axiosClient.post<PortalAccountWithPasswordDto>(BASE, input).then((r) => r.data),

  /** Habilitar / deshabilitar. Deshabilitar revoca TODAS las sesiones activas. `200`. */
  setStatus: (id: string, status: PortalAccountStatus) =>
    axiosClient
      .patch<PortalAccountAdminDto>(`${BASE}/${id}`, { status })
      .then((r) => r.data),

  /**
   * Regenerar la contraseña: genera una nueva, revoca todas las sesiones y la
   * devuelve en texto plano UNA sola vez. Acción sensible (doble confirmación
   * en la UI). `200`.
   */
  regeneratePassword: (id: string) =>
    axiosClient
      .post<PortalAccountWithPasswordDto>(`${BASE}/${id}/regenerate-password`)
      .then((r) => r.data),

  /** Borrar la cuenta. `204` sin body. */
  remove: (id: string) => axiosClient.delete<void>(`${BASE}/${id}`).then(() => undefined),
};
