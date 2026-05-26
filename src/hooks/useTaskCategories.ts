import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskCategoriesApi } from '@/api/taskCategories.api';

const KEY = ['task-categories'] as const;

export function useTaskCategories() {
  return useQuery({ queryKey: KEY, queryFn: taskCategoriesApi.list, staleTime: 60_000 });
}

export function useCreateTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: taskCategoriesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string | null } }) =>
      taskCategoriesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskCategoriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
