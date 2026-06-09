/**
 * Depot stock DTOs (EPIC #38, Wave 3) — read-only view of the DEPOSITO location.
 *
 * Mirrors the backend response of `GET /api/inventory/depot`. The shapes are the
 * enriched DTOs the use case maps from Prisma entities (never raw entities). In
 * production the depot is currently empty, so consumers MUST tolerate empty
 * arrays and a null `depotLocationId`.
 */

/** A single available device sitting in the depot, enriched with its device-type catalog. */
export interface DepotAssetDTO {
  id: string;
  serialNumber: string;
  mac: string | null;
  deviceTypeId: string;
  deviceTypeName: string | null;
  deviceTypeLabel: string | null;
  status: 'available';
  sourceTaskId: string | null;
}

/** A material stock row in the depot, enriched with its material catalog. */
export interface DepotMaterialDTO {
  id: string;
  materialCatalogId: string;
  name: string | null;
  label: string | null;
  unit: string | null;
  qty: number;
}

/** Full depot stock response. `depotLocationId` is null when no DEPOSITO row exists. */
export interface DepotStockDTO {
  assets: DepotAssetDTO[];
  materials: DepotMaterialDTO[];
  depotLocationId: string | null;
}
