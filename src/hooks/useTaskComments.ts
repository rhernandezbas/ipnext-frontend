import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddTaskCommentInput } from '@/types/taskComments';
import * as api from '@/api/taskComments.api';

const queryKey = (taskId: string) => ['task-comments', taskId] as const;

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: queryKey(taskId),
    queryFn: () => api.listTaskComments(taskId),
    enabled: !!taskId,
  });
}

export function useAddTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddTaskCommentInput) => api.addTaskComment(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKey(taskId) }),
  });
}

export function useDeleteTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteTaskComment(commentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKey(taskId) }),
  });
}
