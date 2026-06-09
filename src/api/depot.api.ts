import axiosClient from './axios-client';
import type { DepotStockDTO } from '@/types/depot';

/**
 * Depot stock API (EPIC #38, Wave 3). Read-only.
 *
 * Deliberately separate from `inventory.api.ts` (a broken World-A stub): this
 * module talks only to the Wave 3 endpoint and shares nothing with it.
 *
 * `GET /api/inventory/depot` → `{ assets, materials, depotLocationId }`.
 * The backend always returns a 200 with the empty shape when no DEPOSITO row
 * exists, so callers never need to special-case a 404 here.
 */
export const getDepotStock = (): Promise<DepotStockDTO> =>
  axiosClient.get<DepotStockDTO>('/inventory/depot').then(r => r.data);
