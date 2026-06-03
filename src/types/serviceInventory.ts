export type InstalledItemType = string;
export type InstalledItemStatus = 'active' | 'removed' | 'replaced';

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
}
