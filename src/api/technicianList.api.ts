import axiosClient from './axios-client';
import type { TechnicianListItemDTO } from '@/types/technicianList';

/**
 * Technician list endpoint (EPIC #38, Wave 5b list nav).
 *
 * GET /api/inventory/technicians
 * Returns all technicians ordered by name; those with no TECNICO stock location
 * have assetCount 0 and materialQty 0. Requires inventory.read.
 */
export const getTechnicianList = (): Promise<TechnicianListItemDTO[]> =>
  axiosClient
    .get<TechnicianListItemDTO[]>('/inventory/technicians')
    .then(r => r.data);
