import axiosClient from './axios-client';
import type { AccessPointOption } from '@/types/accessPoint';

/**
 * contract-node-ap-auto-assign (Fase B, picker manual) — GET /api/access-points.
 * Gate BE: `network.read`. Sin `networkSiteId` devuelve el catálogo completo (asignables,
 * missingSince ya filtrado por el BE); con `networkSiteId` lo acota a ese nodo.
 */
export async function listAssignableAccessPoints(
  networkSiteId?: string,
): Promise<AccessPointOption[]> {
  const response = await axiosClient.get<{ data: AccessPointOption[] }>('/access-points', {
    params: networkSiteId ? { networkSiteId } : undefined,
  });
  return response.data.data;
}
