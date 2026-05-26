import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type ProjectVisibilityFilter } from '@/api/projects.api';

const KEY = ['projects'] as const;

export function useProjects(visibility?: ProjectVisibilityFilter) {
  return useQuery({
    queryKey: [...KEY, visibility ?? 'default'],
    queryFn: () => projectsApi.list(visibility),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { title?: string; description?: string; visible?: boolean; workflowId?: string | null };
    }) => projectsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
