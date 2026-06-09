import axiosClient from './axios-client';
import type { TechnicianStockDTO, IssueStockPayload } from '@/types/technician';

/**
 * Technician stock API (EPIC #38, Wave 5a).
 *
 * Sibling of `depot.api.ts` (Wave 3) and shaped the same way: it talks only to
 * the Wave 5a technician endpoints. The stock DTO mirrors the depot stock DTO,
 * so the modal that assigns stock reuses `getDepotStock` to list what's
 * available to issue.
 *
 * - `GET  /api/inventory/technicians/:id/stock`  (perm `inventory.read`)
 * - `POST /api/inventory/technicians/:id/issue`  (perm `inventory.write`)
 *
 * The GET always returns a 200 with the empty shape when no TECNICO row exists,
 * so callers never special-case a 404.
 */

export const getTechnicianStock = (technicianId: string): Promise<TechnicianStockDTO> =>
  axiosClient
    .get<TechnicianStockDTO>(`/inventory/technicians/${technicianId}/stock`)
    .then(r => r.data);

export const issueStockToTechnician = (
  technicianId: string,
  payload: IssueStockPayload,
): Promise<void> =>
  axiosClient
    .post(`/inventory/technicians/${technicianId}/issue`, payload)
    .then(() => undefined);
