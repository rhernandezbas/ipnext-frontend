/** @deprecated use stageCategory; will be removed next change */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// ── Filter types ─────────────────────────────────────────────────────────────
export interface TaskListFilter {
  projectId?:  string;
  stageIds?:   string[];
  /** Client-side filter by stage category (nuevo / enProgreso / hecho / cancelado). Not sent to backend. */
  stageCategory?: TaskStageCategory;
  partnerId?:  string;
  assigneeId?: string;
  priority?:   TaskPriority;
  q?:          string;
  from?:       string;  // ISO datetime — filter tasks where startDate >= from
  to?:         string;  // ISO datetime — filter tasks where startDate <= to
}

export type TasksView = 'table' | 'kanban';

/**
 * Payload for creating a task. Mirrors the backend CreateTaskSchema: only
 * title / priority / category / estimatedHours are required. stageId is
 * technically optional in the DTO but the persistence layer requires a valid
 * stage, so the UI always resolves one from the chosen project's workflow.
 */
export interface CreateTaskPayload {
  title: string;
  priority: TaskPriority;
  category: string;   // free text backed by the TaskCategory catalog
  estimatedHours: number;
  stageId?: string;
  projectId?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  assigneeId?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  order: number;
  fromTemplateItemId: string | null;
  createdAt: string;
  updatedAt: string;
}
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskCategory = 'installation' | 'repair' | 'maintenance' | 'inspection' | 'other';
export type TaskStageCategory = 'nuevo' | 'enProgreso' | 'hecho' | 'cancelado';

export interface ScheduledTask {
  id: string;
  sequenceNumber: number;
  title: string;
  description: string | null;

  /** @deprecated use assigneeId; will be removed in cleanup change */
  assignedTo: string | null;
  /** @deprecated use assigneeId; will be removed in cleanup change */
  assignedToId: string | null;
  /** @deprecated use customerId; will be removed in cleanup change */
  clientId: string | null;
  /** @deprecated use customerName; will be removed in cleanup change */
  clientName: string | null;

  /** @deprecated use stageCategory; will be removed next change */
  status: TaskStatus;
  priority: TaskPriority;

  /** @deprecated use startDate; will be removed in cleanup change */
  scheduledDate: string | null;
  /** @deprecated use startDate; will be removed in cleanup change */
  scheduledTime: string | null;

  estimatedHours: number;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  category: TaskCategory;
  projectId: string | null;
  projectName: string | null;
  completedAt: string | null;
  notes: string | null;

  // Stage (post-change-3) — backend treats these as REQUIRED on the response
  stageId: string;
  stageCategory: TaskStageCategory;

  // Datetime envelope (post-change-3)
  startDate: string | null;
  endDate: string | null;

  // FK relations (post-change-3)
  customerId: string | null;
  customerName: string | null;
  customerCity: string | null;
  serviceId: string | null;
  partnerId: string | null;
  reporterId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;

  // Watchers (post-change-3)
  watcherIds: string[];

  // Travel time in minutes (post-change-3)
  travelTimeTo: number | null;
  travelTimeFrom: number | null;

  // Checklist (change 5) — backend always returns this field, never omits.
  // Defaults to [] when the task has no items. Type is non-nullable.
  checklist: TaskChecklistItem[];

  // Timestamps — backend always returns ISO strings (post-change-1)
  createdAt: string;
  updatedAt: string;
}
