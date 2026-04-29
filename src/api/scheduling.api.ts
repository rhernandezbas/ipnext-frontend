import axiosClient from './axios-client';
import type { ScheduledTask, TaskStatus } from '@/types/scheduling';

const BASE = '/scheduling';

export const listTasks = () =>
  axiosClient.get<ScheduledTask[]>(BASE).then(r => r.data);

export const getTask = (id: string) =>
  axiosClient.get<ScheduledTask>(`${BASE}/${id}`).then(r => r.data);

export const createTask = (data: Omit<ScheduledTask, 'id'>) =>
  axiosClient.post<ScheduledTask>(BASE, data).then(r => r.data);

export const updateTask = (id: string, data: Partial<ScheduledTask>) =>
  axiosClient.put<ScheduledTask>(`${BASE}/${id}`, data).then(r => r.data);

export const deleteTask = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);

export const updateTaskStatus = (id: string, status: TaskStatus) =>
  axiosClient.patch<ScheduledTask>(`${BASE}/${id}/status`, { status }).then(r => r.data);
