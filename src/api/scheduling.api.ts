import axiosClient from './axios-client';
import type { ScheduledTask, TaskStatus, TaskChecklistItem } from '@/types/scheduling';

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

// ── Checklist API ────────────────────────────────────────────────────────────

export const addChecklistItem = (taskId: string, text: string) =>
  axiosClient.post<TaskChecklistItem>(`${BASE}/${taskId}/checklist`, { text }).then(r => r.data);

export const toggleChecklistItem = (taskId: string, itemId: string) =>
  axiosClient.patch<TaskChecklistItem>(`${BASE}/${taskId}/checklist/${itemId}/toggle`).then(r => r.data);

export const updateChecklistItem = (taskId: string, itemId: string, text: string) =>
  axiosClient.patch<TaskChecklistItem>(`${BASE}/${taskId}/checklist/${itemId}`, { text }).then(r => r.data);

export const removeChecklistItem = (taskId: string, itemId: string) =>
  axiosClient.delete(`${BASE}/${taskId}/checklist/${itemId}`);

export const reorderChecklist = (taskId: string, orderedIds: string[]) =>
  axiosClient.put<TaskChecklistItem[]>(`${BASE}/${taskId}/checklist/order`, { orderedIds }).then(r => r.data);

export const assignTemplateToTask = (taskId: string, templateId: string) =>
  axiosClient.post<TaskChecklistItem[]>(`${BASE}/${taskId}/checklist/assign-template`, { templateId }).then(r => r.data);

export const clearChecklist = (taskId: string) =>
  axiosClient.delete(`${BASE}/${taskId}/checklist`);
