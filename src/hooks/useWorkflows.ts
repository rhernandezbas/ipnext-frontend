import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/workflow.api';

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
