import axiosClient from './axios-client';
import type { TaskTemplate } from '@/types/taskTemplate';

const BASE = '/task-templates';

export const listTaskTemplates = () =>
  axiosClient.get<TaskTemplate[]>(BASE).then(r => r.data);

export const getTaskTemplate = (id: string) =>
  axiosClient.get<TaskTemplate>(`${BASE}/${id}`).then(r => r.data);

export const createTaskTemplate = (data: Omit<TaskTemplate, 'id'>) =>
  axiosClient.post<TaskTemplate>(BASE, data).then(r => r.data);

export const updateTaskTemplate = (id: string, data: Partial<Omit<TaskTemplate, 'id'>>) =>
  axiosClient.put<TaskTemplate>(`${BASE}/${id}`, data).then(r => r.data);

export const deleteTaskTemplate = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);
