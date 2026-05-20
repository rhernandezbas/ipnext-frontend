import axiosClient from './axios-client';
import type { ScheduledTask, TaskStatus } from '@/types/scheduling';

const BASE = '/scheduling';

export const listTasks = () =>
  axiosClient.get<ScheduledTask[]>(BASE).then(r => r.data);

export const getTask = (id: string) =>
  axiosClient.get<ScheduledTask>(`${BASE}/${id}`).then(r => r.data);

export const createTask = (data: Omit<ScheduledTask, 'id' | 'sequenceNumber'>) =>
  axiosClient.post<ScheduledTask>(BASE, data).then(r => r.data);

export const updateTask = (id: string, data: Partial<ScheduledTask>) =>
  axiosClient.put<ScheduledTask>(`${BASE}/${id}`, data).then(r => r.data);

export const deleteTask = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);

/** @deprecated use stageCategory flow; kept for legacy compatibility */
export const updateTaskStatus = (id: string, status: TaskStatus) =>
  axiosClient.patch<ScheduledTask>(`${BASE}/${id}/status`, { status }).then(r => r.data);

export const moveTaskToStage = (id: string, stageId: string) =>
  axiosClient.patch<ScheduledTask>(`${BASE}/${id}/stage`, { stageId }).then(r => r.data);
