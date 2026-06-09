/**
 * Vehicle catalog types (EPIC #38, Wave 5b) — ABM de camionetas y su stock.
 *
 * The stock shape mirrors TechnicianStockDTO (Wave 5a): same enriched asset and
 * material DTOs, with root `vehicleId` instead of `technicianId`.
 *
 * The backend returns empty DTO (assets: [], materials: []) when the CAMIONETA
 * StockLocation hasn't been created yet — callers MUST tolerate it.
 */

import type { DepotAssetDTO, DepotMaterialDTO } from '@/types/depot';

/** Vehicle entity as returned by the API. */
export interface Vehicle {
  id: string;
  plate: string;
  name: string | null;
  assignedTechnicianId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

/** Full vehicle stock response. Mirrors TechnicianStockDTO. */
export interface VehicleStockDTO {
  vehicleId: string;
  assets: DepotAssetDTO[];
  materials: DepotMaterialDTO[];
}

/** One item to issue to a vehicle: either a single asset or a material quantity. */
export type VehicleIssueStockItem =
  | { assetId: string }
  | { materialCatalogId: string; qty: number };

/** Body of `POST /api/inventory/vehicles/:id/issue`. */
export interface IssueStockToVehiclePayload {
  items: VehicleIssueStockItem[];
}

/** Body of `POST /api/vehicles`. */
export interface CreateVehiclePayload {
  plate: string;
  name?: string | null;
  assignedTechnicianId?: string | null;
}

/** Body of `PATCH /api/vehicles/:id`. */
export interface UpdateVehiclePayload {
  plate?: string;
  name?: string | null;
  assignedTechnicianId?: string | null;
  status?: 'active' | 'inactive';
}
