import { useMutation, useQueryClient } from '@tanstack/react-query';
import { depotEntryApi, type AddDepotAssetPayload, type LoadDepotMaterialPayload } from '@/api/depotEntry.api';
import { DEPOT_STOCK_QUERY_KEY } from '@/hooks/useDepotStock';

/**
 * Mutation hooks for loading stock into the depot (EPIC #38, Wave — depot stock entry).
 *
 * Both hooks invalidate the depot stock query on success so `useDepotStock`
 * callers (InventoryDepotPage, assign modals) see fresh data.
 * Also invalidates the inventory-overview query so the dashboard reflects
 * the new totals without a manual refresh.
 */

const OVERVIEW_QUERY_KEY = ['inventory-overview'] as const;

/**
 * Add a single device asset to the depot.
 *
 * `POST /api/inventory/depot/assets`
 * Body: `{ deviceTypeId, serialNumber?, mac?, note? }` — at least one of serial/mac required.
 * Success (201): `{ id, deviceTypeId, deviceTypeName, serialNumber, mac, status }`.
 * Error codes: 400, 404 `DEVICE_TYPE_NOT_FOUND`, 409 `ASSET_ALREADY_EXISTS`.
 */
export function useAddDepotAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddDepotAssetPayload) => depotEntryApi.addAsset(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPOT_STOCK_QUERY_KEY });
      qc.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    },
  });
}

/**
 * Load a batch of material quantity into the depot.
 *
 * `POST /api/inventory/depot/materials`
 * Body: `{ materialCatalogId, qty: >0, note? }`.
 * Success (200): `{ ok, materialCatalogId, newQty }`.
 * Error codes: 400 (invalid qty), 404 `MATERIAL_NOT_FOUND`.
 */
export function useLoadDepotMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoadDepotMaterialPayload) => depotEntryApi.loadMaterial(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPOT_STOCK_QUERY_KEY });
      qc.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    },
  });
}
