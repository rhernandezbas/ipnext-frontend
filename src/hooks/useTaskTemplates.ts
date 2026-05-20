import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskTemplate, TaskTemplateItem } from '@/types/taskTemplate';
import * as api from '@/api/taskTemplate.api';

export function useTaskTemplates() {
  return useQuery({ queryKey: ['task-templates'], queryFn: api.listTaskTemplates });
}

export function useCreateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TaskTemplate, 'id'>) => api.createTaskTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

export function useUpdateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<TaskTemplate, 'id'>> }) =>
      api.updateTaskTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTaskTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

export function useReplaceTemplateItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: { text: string }[] }) =>
      api.replaceTemplateItems(id, items),
    onSuccess: (_result: TaskTemplateItem[], { id }: { id: string; items: { text: string }[] }) => {
      void qc.invalidateQueries({ queryKey: ['task-templates'] });
      void qc.invalidateQueries({ queryKey: ['task-template', id] });
    },
  });
}
