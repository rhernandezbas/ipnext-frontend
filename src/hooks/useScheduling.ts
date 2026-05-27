import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduledTask, TaskChecklistItem, TaskListFilter, CreateTaskPayload } from '@/types/scheduling';
import * as api from '@/api/scheduling.api';

export function useTasks() {
  return useQuery({ queryKey: ['scheduling-tasks'], queryFn: () => api.listTasks() });
}

/**
 * Like useTasks but accepts a filter and uses a filter-keyed queryKey.
 * Used by SchedulingTasksPage — does NOT affect other pages using useTasks().
 */
export function useFilteredTasks(filter: TaskListFilter = {}) {
  return useQuery({
    queryKey: ['scheduling-tasks', filter],
    queryFn: () => api.listTasks(filter),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['scheduling-task', id],
    queryFn: () => api.getTask(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskPayload) => api.createTask(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledTask> }) =>
      api.updateTask(id, data),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
      void qc.invalidateQueries({ queryKey: ['scheduling-task', id] });
    },
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
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateTaskStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduling-tasks'] }),
  });
}

export function useMoveTaskToStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.moveTaskToStage(id, stageId),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-task', id] });
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
    },
  });
}

// ── Checklist hooks ──────────────────────────────────────────────────────────

export function useAddChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.addChecklistItem(taskId, text),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

export function useToggleChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.toggleChecklistItem(taskId, itemId),
    onMutate: async (itemId: string) => {
      await qc.cancelQueries({ queryKey: ['scheduling-task', taskId] });
      const snapshot = qc.getQueryData<ScheduledTask>(['scheduling-task', taskId]);
      if (snapshot) {
        qc.setQueryData<ScheduledTask>(['scheduling-task', taskId], {
          ...snapshot,
          checklist: snapshot.checklist.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        });
      }
      return { snapshot };
    },
    onError: (_err, _itemId, context) => {
      if (context?.snapshot) {
        qc.setQueryData(['scheduling-task', taskId], context.snapshot);
      }
    },
    onSettled: (_data, err) => {
      if (err) {
        void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
      }
    },
  });
}

export function useUpdateChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      api.updateChecklistItem(taskId, itemId, text),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

export function useRemoveChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.removeChecklistItem(taskId, itemId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

export function useReorderChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderChecklist(taskId, orderedIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

export function useAssignTemplateToTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.assignTemplateToTask(taskId, templateId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

export function useClearChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearChecklist(taskId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] }),
  });
}

// Type alias exported for convenience in components
export type { TaskChecklistItem };
