import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/workflow.api';

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

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: api.listWorkflows,
    staleTime: 60_000,
  });
}
