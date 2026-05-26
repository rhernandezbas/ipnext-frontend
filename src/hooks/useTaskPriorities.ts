import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskPrioritiesApi } from '@/api/taskPriorities.api';

const KEY = ['task-priorities'] as const;

export function useTaskPriorities() {
  return useQuery({ queryKey: KEY, queryFn: taskPrioritiesApi.list, staleTime: 60_000 });
}

export function useCreateTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: taskPrioritiesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string; weight?: number } }) =>
      taskPrioritiesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskPrioritiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
