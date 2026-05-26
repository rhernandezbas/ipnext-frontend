import axiosClient from './axios-client';
import type { TaskCategory } from '@/types/taskCategory';

const BASE = '/scheduling/task-categories';

export const taskCategoriesApi = {
  list: () => axiosClient.get<TaskCategory[]>(BASE).then(r => r.data),
  create: (data: { name: string; description?: string | null }) =>
    axiosClient.post<TaskCategory>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string; description?: string | null }) =>
    axiosClient.put<TaskCategory>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
