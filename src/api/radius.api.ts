import axiosClient from './axios-client';
import type { RadiusSession, PaginatedRadiusSessions, RadiusSessionsParams } from '../types/radiusSessions';

/** Legacy (sin params) → array puro (back-compat). */
export const getRadiusSessions = () =>
  axiosClient.get<RadiusSession[]>('/radius/sessions').then(r => r.data);

/** Con params → envelope paginado.
 *  El FE rediseñado SIEMPRE manda page+limit → siempre recibe envelope. */
export const getRadiusSessionsPaginated = (params: RadiusSessionsParams) => {
  const p: Record<string, string | number> = { page: params.page, limit: params.limit };
  if (params.search) p.search = params.search;
  if (params.nasId) p.nasId = params.nasId;
  if (params.status) p.status = params.status;
  return axiosClient.get<PaginatedRadiusSessions>('/radius/sessions', { params: p }).then(r => r.data);
};

export const disconnectSession = (id: string) =>
  axiosClient.delete<{ success: boolean }>(`/radius/sessions/${id}`).then(r => r.data);
