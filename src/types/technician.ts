/**
 * Technician stock DTOs (EPIC #38, Wave 5a) — read-only view of a technician's
 * TECNICO location, plus the issue (assign) payload.
 *
 * The stock shape mirrors `DepotStockDTO` (Wave 3): the same enriched asset and
 * material DTOs, reused verbatim. In production a technician starts with an
 * EMPTY location, so consumers MUST tolerate empty arrays and a null
 * `locationId` — the empty state is the primary UX.
 */

import type { DepotAssetDTO, DepotMaterialDTO } from '@/types/depot';

/** Full technician stock response. `locationId` is null when no TECNICO row exists yet. */
export interface TechnicianStockDTO {
  assets: DepotAssetDTO[];
  materials: DepotMaterialDTO[];
  locationId: string | null;
}

/** One item to issue: either a single asset (by id) or a material quantity. */
export type IssueStockItem =
  | { assetId: string }
  | { materialCatalogId: string; qty: number };

/** Body of `POST /api/inventory/technicians/:id/issue`. */
export interface IssueStockPayload {
  items: IssueStockItem[];
}
