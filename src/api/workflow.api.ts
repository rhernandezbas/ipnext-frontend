import axiosClient from './axios-client';
import type { Workflow, WorkflowStage } from '@/types/workflow';
import type { TaskStageCategory } from '@/types/scheduling';

export const getWorkflow = (id: string) =>
  axiosClient.get<Workflow>(`/scheduling/workflows/${id}`).then(r => r.data);

export const listWorkflows = () =>
  axiosClient.get<Workflow[]>('/scheduling/workflows').then(r => r.data);

export const updateStageColor = (workflowId: string, stageId: string, color: string) =>
  axiosClient
    .patch(`/scheduling/workflows/${workflowId}/stages/${stageId}/color`, { color })
    .then(r => r.data);

export const createStage = (
  workflowId: string,
  data: { name: string; category: TaskStageCategory; order: number },
): Promise<WorkflowStage> =>
  axiosClient
    .post<WorkflowStage>(`/scheduling/workflows/${workflowId}/stages`, data)
    .then(r => r.data);

export const updateStage = (
  workflowId: string,
  stageId: string,
  data: { name?: string; category?: TaskStageCategory },
): Promise<WorkflowStage> =>
  axiosClient
    .patch<WorkflowStage>(`/scheduling/workflows/${workflowId}/stages/${stageId}`, data)
    .then(r => r.data);

export const reorderStages = (workflowId: string, order: string[]): Promise<Workflow> =>
  axiosClient
    .put<Workflow>(`/scheduling/workflows/${workflowId}/stages/reorder`, { order })
    .then(r => r.data);

export const deleteStage = (workflowId: string, stageId: string): Promise<void> =>
  axiosClient
    .delete(`/scheduling/workflows/${workflowId}/stages/${stageId}`)
    .then(() => undefined);
