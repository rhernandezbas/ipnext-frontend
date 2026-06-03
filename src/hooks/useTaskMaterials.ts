import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskMaterialsApi } from '@/api/taskMaterials.api';
import type { RecordTaskMaterialInput } from '@/types/taskMaterial';

const materialsKey = (taskId: string) => ['task-materials', taskId] as const;

export function useTaskMaterials(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: materialsKey(taskId ?? ''),
    queryFn: () => taskMaterialsApi.list(taskId!),
    enabled: !!taskId && enabled,
  });
}

export function useRecordTaskMaterial(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordTaskMaterialInput) => taskMaterialsApi.record(taskId, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: materialsKey(taskId) }),
  });
}

export function useDeleteTaskMaterial(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskMaterialsApi.delete(taskId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: materialsKey(taskId) }),
  });
}
