export type InstalledItemType = string;
export type InstalledItemStatus = 'active' | 'removed' | 'replaced';

/** Result from GET /contracts/:contractId/inspect-pppoe-devices */
export interface InspectPppoeDevicesResult {
  antenna: {
    mac: string | null;
    model: string | null;
  };
  router: {
    mac: string;
    brand: string | null;
  } | null;
  warnings: string[];
}

/** A physical device installed on a contract (Service). One row = one device. */
export interface ServiceInstalledItem {
  id: string;
  serviceId: string;
  type: InstalledItemType;
  serialNumber: string | null;
  mac: string | null;
  model: string | null;
  source: string; // OCR | MANUAL | ICLASS
  sourceTaskId: string | null;
  addedByUserId: string | null;
  /** Display name of the operator who approved it (resolved by the BE). */
  addedByUserName: string | null;
  confirmedAt: string | null;
  status: InstalledItemStatus;
  notes: string | null;
  createdAt: string;
}

/**
 * A physical device installed on one of a client's contracts, decorated with
 * the contract context needed to group it (EPIC #38 W2). Aggregated, read-only:
 * returned by `GET /api/clients/:clientId/equipment`. Distinct from
 * `ServiceInstalledItem` (per-contract, mutable) — this view spans all contracts.
 */
export interface ClientInstalledItem {
  id: string;
  type: InstalledItemType;
  serialNumber: string | null;
  mac: string | null;
  model: string | null;
  status: InstalledItemStatus;
  source: string;
  confirmedAt: string | null;
  assetId: string | null;
  // contract context (for grouping)
  contractId: string;
  contractPlan: string;
  contractType: string;
}

export interface AddInstalledItemInput {
  type: InstalledItemType;
  serialNumber?: string;
  mac?: string;
  model?: string;
  notes?: string;
  /**
   * Dedup decision: enrich the existing item with this id instead of creating a
   * new one. Used to resolve a SAME_TYPE_NEEDS_DECISION 409 by choosing which
   * existing item the operator wants to complete. Mutually exclusive with `force`.
   */
  completeItemId?: string;
  /**
   * Dedup decision: bypass the same-type dedup check and create a NEW item even
   * if one of the same type already exists. Used to resolve a
   * SAME_TYPE_NEEDS_DECISION 409 with "agregar como nuevo".
   */
  force?: boolean;
}

/**
 * Outcome of `addInstalledItem`. The BE distinguishes a freshly created item
 * (HTTP 201) from an enriched/revived existing one (HTTP 200) ONLY via the
 * status code — the body shape is identical. `outcome` makes that explicit for
 * the UI so it can say "agregado" vs "datos completados".
 */
export interface AddInstalledItemResult {
  /** 'created' ← HTTP 201; 'enriched' ← HTTP 200. */
  outcome: 'created' | 'enriched';
  item: ServiceInstalledItem;
}

/** A SAME_TYPE candidate the operator can choose to complete (from the 409 body). */
export interface SameTypeCandidate {
  id: string;
  type: InstalledItemType;
  serialNumber: string | null;
  mac: string | null;
  model: string | null;
}

/** Machine-readable dedup conflict codes the BE returns on a 409. */
export type InventoryConflictCode = 'SAME_TYPE_NEEDS_DECISION' | 'ASSET_NOT_REVIVABLE';

/**
 * Normalized 409 conflict surfaced by the add-inventory flow. The BE returns a
 * 409 with `{ error: <human msg>, code, candidates? }`; the api client maps the
 * axios error into this shape so the UI can branch on `code` without digging
 * into `err.response.data`.
 */
export interface InventoryConflict {
  code: InventoryConflictCode;
  /** Human-readable message from the BE (the `error` field). */
  message: string;
  /** Present only for SAME_TYPE_NEEDS_DECISION. */
  candidates: SameTypeCandidate[];
}

export interface UpdateInstalledItemInput {
  status?: InstalledItemStatus;
  notes?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  mac?: string | null;
}

/**
 * Where a removed equipment item ends up. Mirrors the BE retire contract
 * (POST /contracts/:contractId/inventory/:itemId/retire). `TECNICO` is the only
 * disposition that requires a `technicianId`.
 */
export type RetireDisposition =
  | 'DEPOSITO'
  | 'TECNICO'
  | 'CLIENTE'
  | 'DAMAGED'
  | 'RETIRED';

/** Disposition → Spanish label for the UI (radio options / summaries). */
export const RETIRE_DISPOSITION_LABELS: Record<RetireDisposition, string> = {
  DEPOSITO: 'Depósito',
  TECNICO: 'Con un técnico',
  CLIENTE: 'Se lo queda el cliente',
  DAMAGED: 'Dañado',
  RETIRED: 'Baja definitiva',
};

/** Body for the retire endpoint. `technicianId` is required iff disposition === 'TECNICO'. */
export interface RetireInstalledItemInput {
  disposition: RetireDisposition;
  /** Required only when disposition === 'TECNICO'. */
  technicianId?: string;
  /** Optional free-text note. */
  note?: string;
}

/** Machine-readable conflict code the retire endpoint returns on a 409. */
export type RetireConflictCode = 'ASSET_NOT_INSTALLED';

/** Discriminated union returned by POST .../confirm — a device OR a material consumption. */
export type ConfirmSuggestionResult =
  | { kind: 'DEVICE'; item: ServiceInstalledItem }
  | { kind: 'MATERIAL'; consumption: TaskMaterialConsumption };

/** A recorded material consumption on a task. */
export interface TaskMaterialConsumption {
  id: string;
  taskId: string;
  materialCatalogId: string;
  materialName: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  recordedByUserName: string | null;
  createdAt: string;
}

/** Input to create a manual inventory suggestion on a task. */
export interface CreateManualSuggestionInput {
  kind: 'DEVICE' | 'MATERIAL';
  type?: string;
  serialNumber?: string | null;
  mac?: string | null;
  materialDesc?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

/** A staged inventory suggestion on a task (the operator's checkboxes). */
export interface TaskInventorySuggestion {
  id: string;
  taskId: string;
  kind: 'DEVICE' | 'MATERIAL';
  deviceType: string | null;
  /** Tipo que el modelo de visión infirió de la foto (badge "qwen sugiere"), o null. */
  qwenDeviceType: string | null;
  serialNumber: string | null;
  mac: string | null;
  materialDesc: string | null;
  quantity: number | null;
  unit: string | null;
  source: string;
  photoUrl: string | null;
  status: 'pending' | 'confirmed' | 'discarded';
  confirmedItemId: string | null;
  /** Match against the active inventory of the contract (DEVICE only). Optional for graceful degradation (CC-2). */
  match?: {
    status: 'same_device' | 'same_type';
    itemId: string;
    serial: string | null;
  } | null;
}
