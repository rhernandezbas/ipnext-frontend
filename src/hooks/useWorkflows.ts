import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/workflow.api';
import type { TaskStageCategory } from '@/types/scheduling';

export function useUpdateStageColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stageId, color }: { workflowId: string; stageId: string; color: string }) =>
      api.updateStageColor(workflowId, stageId, color),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows'] });
      void qc.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}

export function useWorkflow(id: string | null | undefined) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.getWorkflow(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * `enabled` (default `true`, bulk-task-recipients FE, D8) — lo ata el caller a
 * un permiso cuando corresponda (molde `useTemplates(enabled)`).
 * `TaskStageConfigCard` lo gatea a `scheduling.read`: sin el permiso, el
 * catálogo de estados ni se pide (403 seguro, ningún "Reintentá" lo cura).
 * Backcompat: los 10 callers existentes lo invocan sin argumento → sigue
 * fetcheando igual que antes.
 */
export function useWorkflows(enabled: boolean = true) {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: api.listWorkflows,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      data,
    }: {
      workflowId: string;
      data: { name: string; category: TaskStageCategory; order: number };
    }) => api.createStage(workflowId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows'] });
      void qc.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      stageId,
      data,
    }: {
      workflowId: string;
      stageId: string;
      data: { name?: string; category?: TaskStageCategory };
    }) => api.updateStage(workflowId, stageId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows'] });
      void qc.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, order }: { workflowId: string; order: string[] }) =>
      api.reorderStages(workflowId, order),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows'] });
      void qc.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, stageId }: { workflowId: string; stageId: string }) =>
      api.deleteStage(workflowId, stageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows'] });
      void qc.invalidateQueries({ queryKey: ['workflow'] });
    },
  });
}
