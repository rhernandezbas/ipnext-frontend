import axiosClient from './axios-client';
import type { ScheduledTask, TaskChecklistItem, TaskListFilter, CreateTaskPayload, TaskGeneralStatus } from '@/types/scheduling';

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
  if (filter?.kind)       params['kind']         = filter.kind;
  // #41 — the FE always sends an explicit general-status filter (default 'open').
  if (filter?.status)     params['status']       = filter.status;
  // #86 — archived flag: when true, only archived tasks are returned.
  if (filter?.archived !== undefined) params['archived'] = String(filter.archived);
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

/**
 * Set a task's general status (#41) — open / closed / dismissed.
 * POST /scheduling/:id/status (auth + scheduling.write). Idempotent: re-sending
 * the current status returns 200 without recording an activity. Returns the full
 * task DTO with the derived `isClosed`.
 */
export const setTaskGeneralStatus = (id: string, status: TaskGeneralStatus) =>
  axiosClient.post<ScheduledTask>(`${BASE}/${id}/status`, { status }).then(r => r.data);

export const moveTaskToStage = (id: string, stageId: string) =>
  axiosClient.patch<ScheduledTask>(`${BASE}/${id}/stage`, { stageId }).then(r => r.data);

// ── Bulk move to stage ─────────────────────────────────────────────────────────

/** Per-task result of a bulk stage move. `ok:false` carries the failure detail. */
export interface BulkStageResult {
  taskId: string;
  ok: boolean;
  errorCode?: string;
  reason?: string;
  missingFields?: string[];
}

export interface BulkStageResponse {
  summary: { total: number; ok: number; failed: number };
  results: BulkStageResult[];
}

/**
 * Move many tasks to a stage in one call. The endpoint always returns 200 with a
 * per-task result so partial failures are reported instead of swallowed.
 */
export const bulkMoveToStage = (ids: string[], stageId: string) =>
  axiosClient
    .post<BulkStageResponse>(`${BASE}/bulk/stage`, { ids, stageId })
    .then(r => r.data);

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

// ── Manual equipment retirement (#39) ───────────────────────────────────────

export interface RetiredItemResult {
  itemId: string;
  status: 'removed';
  assetId: string | null;
  movementId: string | null;
}

export interface RetireEquipmentResult {
  retired: RetiredItemResult[];
  skipped: { itemId: string; reason: 'already-removed' | 'asset-in-depot' }[];
}

export const retireEquipment = (taskId: string, itemIds: string[]) =>
  axiosClient
    .post<RetireEquipmentResult>(`${BASE}/${taskId}/inventory/retire`, { itemIds })
    .then(r => r.data);

// ── Inventory review ─────────────────────────────────────────────────────────

export const setTaskInventoryReview = (taskId: string, reviewed: boolean) =>
  axiosClient
    .patch<ScheduledTask>(`${BASE}/${taskId}/inventory-review`, { reviewed })
    .then(r => r.data);

// ── Archive (#86) ─────────────────────────────────────────────────────────────

/**
 * Archive a task. Only tasks with generalStatus !== 'open' can be archived;
 * the backend returns 422 TASK_NOT_CLOSED otherwise.
 * POST /scheduling/:id/archive → 200 ScheduledTask.
 */
export const archiveTask = (id: string) =>
  axiosClient.post<ScheduledTask>(`${BASE}/${id}/archive`).then(r => r.data);

// ── IClass manual resend ─────────────────────────────────────────────────────

export interface IClassNode {
  code: string;
  description: string;
}

export const listIClassNodes = () =>
  axiosClient
    .get<{ nodes: IClassNode[] }>(`${BASE}/iclass/nodes`)
    .then(r => r.data.nodes);

export const resendTaskToIClass = (taskId: string, nodeCode: string) =>
  axiosClient
    .post<ScheduledTask>(`${BASE}/${taskId}/iclass/resend`, { nodeCode })
    .then(r => r.data);

// ── Difusión al NOC por WhatsApp (N3-FE / task-broadcast-fe) ──────────────────

/** Resultado de difundir una tarea de red al canal del NOC. */
export interface BroadcastNocResult {
  sent: boolean;
  /** Deep-link a la tarea incluido en el mensaje enviado al canal. */
  link: string;
}

/**
 * Difunde una tarea de RED al canal del NOC por WhatsApp.
 * POST /scheduling/:id/broadcast-noc (auth + scheduling.write, body vacío) →
 * 200 { sent, link }. Errores tipados (mismo envelope { error, code }):
 *   404 TASK_NOT_FOUND · 422 TASK_NOT_BROADCASTABLE (solo kind='network') ·
 *   503 NOC_BROADCAST_NOT_CONFIGURED · 502 EVOLUTION_API_ERROR ·
 *   422 NOC_BROADCAST_LINK_BASE_MISSING.
 */
export const broadcastTaskToNoc = (taskId: string) =>
  axiosClient
    .post<BroadcastNocResult>(`${BASE}/${taskId}/broadcast-noc`)
    .then(r => r.data);
