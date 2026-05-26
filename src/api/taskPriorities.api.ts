import axiosClient from './axios-client';
import type { TaskPriority } from '@/types/taskPriority';

const BASE = '/scheduling/task-priorities';

export const taskPrioritiesApi = {
  list: () => axiosClient.get<TaskPriority[]>(BASE).then(r => r.data),
  create: (data: { name: string; color: string; weight: number }) =>
    axiosClient.post<TaskPriority>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string; color?: string; weight?: number }) =>
    axiosClient.put<TaskPriority>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
