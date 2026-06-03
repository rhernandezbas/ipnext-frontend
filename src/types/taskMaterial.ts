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

export interface RecordTaskMaterialInput {
  materialCatalogId: string;
  quantity: number;
  notes?: string;
}
