import axiosClient from './axios-client';

/**
 * Depot stock entry API (EPIC #38, Wave — depot stock entry).
 *
 * Two mutation endpoints:
 * - `POST /api/inventory/depot/assets`    → add a single device to the depot
 * - `POST /api/inventory/depot/materials` → load material qty to the depot
 *
 * Error shape from BE: `{ error: string, code: string }`.
 * Guards: `inventory.write`.
 */

export interface AddDepotAssetPayload {
  deviceTypeId: string;
  /** At least one of serialNumber / mac is required (BE enforces, FE validates). */
  serialNumber?: string;
  mac?: string;
  note?: string;
}

export interface AddDepotAssetResponse {
  id: string;
  deviceTypeId: string;
  deviceTypeName: string;
  serialNumber: string | null;
  mac: string | null;
  status: string;
}

export interface LoadDepotMaterialPayload {
  materialCatalogId: string;
  /** Must be > 0 */
  qty: number;
  note?: string;
}

export interface LoadDepotMaterialResponse {
  ok: boolean;
  materialCatalogId: string;
  newQty: number;
}

const BASE = '/inventory/depot';

export const depotEntryApi = {
  addAsset: (payload: AddDepotAssetPayload): Promise<AddDepotAssetResponse> =>
    axiosClient.post<AddDepotAssetResponse>(`${BASE}/assets`, payload).then(r => r.data),

  loadMaterial: (payload: LoadDepotMaterialPayload): Promise<LoadDepotMaterialResponse> =>
    axiosClient.post<LoadDepotMaterialResponse>(`${BASE}/materials`, payload).then(r => r.data),
};
