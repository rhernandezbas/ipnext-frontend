import type { TaskStageCategory } from './scheduling';

export interface WorkflowStage {
  id: string;
  workflowId: string;
  name: string;
  category: TaskStageCategory;
  order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  stages: WorkflowStage[];
  createdAt: string;
  updatedAt: string;
}
