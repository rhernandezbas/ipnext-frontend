export interface Project {
  id: string;
  title: string;
  description: string | null;
  workflowId: string | null;
  visible?: boolean;
  /** Whether this project allows manual equipment retirement (#39). */
  allowsEquipmentRetirement?: boolean;
  createdAt: string;
  updatedAt: string;
  taskCounts?: {
    nuevo: number;
    enProgreso: number;
    hecho: number;
    total: number;
  };
  iclassSoTypeId?: string | null;
  iclassSoType?: {
    id: string;
    code: string;
    description: string;
    active: boolean;
  } | null;
}
