import axiosClient from './axios-client';
import type { ScheduledTask, TaskChecklistItem, TaskListFilter, CreateTaskPayload } from '@/types/scheduling';

const BASE = '/scheduling';

/**
 * Build query params from a TaskListFilter.
 * stageIds are serialised as repeated ?stageIds[]=a&stageIds[]=b so Express 4
 * parses them to req.query.stageIds = ['a', 'b'] (qs bracket notation).
 */
function buildFilterParams(filter?: TaskListFilter): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  if (filter?.projectId)  params['projectId']    = filter.projectId;
  if (filter?.stageIds?.length) params['stageIds[]'] = filter.stageIds;
  if (filter?.partnerId)  params['partnerId']    = filter.partnerId;
  if (filter?.assigneeId) params['assigneeId']   = filter.assigneeId;
  if (filter?.customerId) params['customerId']   = filter.customerId;
  if (filter?.q)          params['q']            = filter.q;
  if (filter?.priority)   params['priority']     = filter.priority;
  if (filter?.from)       params['from']         = filter.from;
  if (filter?.to)         params['to']           = filter.to;
  return params;
}

export const listTasks = (filter?: TaskListFilter) =>
  axiosClient.get<ScheduledTask[]>(BASE, { params: buildFilterParams(filter) }).then(r => r.data);

export const getTask = (id: string) =>
  axiosClient.get<ScheduledTask>(`${BASE}/${id}`).then(r => r.data);

export const createTask = (data: CreateTaskPayload) =>
  axiosClient.post<ScheduledTask>(BASE, data).then(r => r.data);

export const updateTask = (id: string, data: Partial<ScheduledTask>) =>
  axiosClient.put<ScheduledTask>(`${BASE}/${id}`, data).then(r => r.data);

export const deleteTask = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);

/** @deprecated use stageCategory flow; kept for legacy compatibility */
export const updateTaskStatus = (id: string, status: string) =>
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

// ── Inventory review ─────────────────────────────────────────────────────────

export const setTaskInventoryReview = (taskId: string, reviewed: boolean) =>
  axiosClient
    .patch<ScheduledTask>(`${BASE}/${taskId}/inventory-review`, { reviewed })
    .then(r => r.data);
