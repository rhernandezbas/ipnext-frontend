import axiosClient from './axios-client';
import type { Project } from '@/types/project';

export const projectsApi = {
  list: () => axiosClient.get<Project[]>('/projects').then(r => r.data),
  get: (id: string) => axiosClient.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: { title: string; description?: string }) =>
    axiosClient.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: { title?: string; description?: string }) =>
    axiosClient.put<Project>(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`/projects/${id}`),
};
