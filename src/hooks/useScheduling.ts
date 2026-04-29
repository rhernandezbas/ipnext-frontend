import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduledTask, TaskStatus } from '@/types/scheduling';
import * as api from '@/api/scheduling.api';

export function useTasks() {
  return useQuery({ queryKey: ['scheduling-tasks'], queryFn: api.listTasks });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ScheduledTask, 'id'>) => api.createTask(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledTask> }) =>
      api.updateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.updateTaskStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}
