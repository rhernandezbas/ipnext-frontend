import axiosClient from './axios-client';
import type { PortalAccountListDto } from '@/types/portalAccount';

const BASE = '/admin/portal-accounts';

export interface ListPortalAccountsParams {
  page?: number;
  limit?: number;
}

export const portalAccountsApi = {
  /**
   * Listado paginado. El BE capea `limit` en 100 y rechaza cualquier cosa que
   * no sea un entero >= 1 — la portada pide `limit: 1` porque sólo necesita el
   * `total`, no las filas (traer 100 cuentas para mostrar un número sería
   * tirar ancho de banda a la basura).
   */
  list: (params: ListPortalAccountsParams = {}) =>
    axiosClient.get<PortalAccountListDto>(BASE, { params }).then((r) => r.data),
};
