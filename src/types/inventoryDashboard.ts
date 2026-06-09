// Wire types for the World B Inventory Dashboard endpoints.
// Fields match the BE DTOs in design.md exactly — do NOT rename.

export type MovementType = 'ISSUE' | 'TRANSFER' | 'INSTALL' | 'RETURN' | 'CONSUME' | 'ADJUST';
export type StockLocationType = 'DEPOSITO' | 'CLIENTE' | 'TECNICO' | 'CAMIONETA';

// --- GET /api/inventory/overview/locations ---

export interface OverviewLocationDTO {
  locationId: string;
  label: string | null;
  assetCount: number;
  materialQty: number;
}

export interface OverviewGroupDTO {
  type: StockLocationType;
  locationCount: number;
  totalAssets: number;
  totalMaterialQty: number;
  locations: OverviewLocationDTO[];
}

export interface InventoryOverviewDTO {
  groups: OverviewGroupDTO[];
}

// --- GET /api/inventory/movements ---

export interface MovementRowDTO {
  id: string;
  type: MovementType;
  occurredAt: string;
  assetId: string | null;
  materialCatalogId: string | null;
  materialName: string | null;
  qty: number | null;
  fromLocationId: string | null;
  fromLocationLabel: string | null;
  toLocationId: string | null;
  toLocationLabel: string | null;
  taskId: string | null;
  taskSeq: number | null;
  technicianId: string | null;
  technicianName: string | null;
  source: string;
  note: string | null;
}

export interface InventoryMovementListDTO {
  items: MovementRowDTO[];
  total: number;
  page: number;
  limit: number;
}

export interface MovementFilters {
  type?: MovementType;
  locationId?: string;
  materialCatalogId?: string;
  taskId?: string;
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// --- GET /api/inventory/alerts ---

export interface LowStockAlertDTO {
  materialCatalogId: string;
  name: string;
  label: string | null;
  unit: string | null;
  totalQty: number;
  minStock: number;
  deficit: number;
}
