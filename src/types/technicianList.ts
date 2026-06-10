/**
 * Technician list DTO (EPIC #38, Wave 5b list nav).
 *
 * GET /api/inventory/technicians → TechnicianListItemDTO[]
 * Sorted by name. assetCount and materialQty are 0 for technicians with no
 * TECNICO stock location yet (they are included in the list).
 */
export interface TechnicianListItemDTO {
  id: string;
  name: string;
  assetCount: number;
  materialQty: number;
}
