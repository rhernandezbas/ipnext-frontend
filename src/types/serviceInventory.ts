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
}

export interface UpdateInstalledItemInput {
  status?: InstalledItemStatus;
  notes?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  mac?: string | null;
}

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
