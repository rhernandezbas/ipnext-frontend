export interface Project {
  id: string;
  title: string;
  description: string | null;
  workflowId: string | null;
  visible?: boolean;
  createdAt: string;
  updatedAt: string;
  taskCounts?: {
    nuevo: number;
    enProgreso: number;
    hecho: number;
    total: number;
  };
}
