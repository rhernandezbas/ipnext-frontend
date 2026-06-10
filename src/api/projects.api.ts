import axiosClient from './axios-client';
import type { Project } from '@/types/project';

export type ProjectVisibilityFilter = 'true' | 'false' | 'all';

export const projectsApi = {
  list: (visibility?: ProjectVisibilityFilter) =>
    axiosClient
      .get<Project[]>('/projects', { params: visibility ? { visible: visibility } : undefined })
      .then(r => r.data),
  get: (id: string) => axiosClient.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: { title: string; description?: string; workflowId?: string | null }) =>
    axiosClient.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: {
    title?: string;
    description?: string;
    visible?: boolean;
    workflowId?: string | null;
    iclassSoTypeId?: string | null;
    allowsEquipmentRetirement?: boolean;
  }) =>
    axiosClient.patch<Project>(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`/projects/${id}`),
};
