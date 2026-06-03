// ── Filter types ─────────────────────────────────────────────────────────────
export interface TaskListFilter {
  projectId?:  string;
  stageIds?:   string[];
  /** Client-side filter by stage category (nuevo / enProgreso / hecho / cancelado). Not sent to backend. */
  stageCategory?: TaskStageCategory;
  partnerId?:  string;
  assigneeId?: string;
  customerId?: string;
  priority?:   string;   // catalog priority name
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
  priority: string;   // free text backed by the TaskPriority catalog
  category: string;   // free text backed by the TaskCategory catalog
  estimatedHours: number;
  stageId?: string;
  projectId?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  contractId?: string | null;
  assigneeId?: string | null;
  address?: string | null;
  notes?: string | null;
  /** Originating ticket id when the task is created from a ticket (tickets-actions-be). */
  ticketId?: number | null;
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

  priority: string;   // catalog priority name (free text)

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
  contractId: string | null;
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

  /** Closed flag — set via PUT /scheduling/:id with { isClosed: true }.
   *  A closed task is NOT deleted; it is hidden from active views.
   *  Only admins / superadmins can physically delete tasks. */
  isClosed?: boolean;

  /** Inventory review flag — set via PATCH /scheduling/:id/inventory-review.
   *  Indicates that the inventory team has reviewed the task (RV). */
  reviewedByInventory: boolean;

  /** ISO datetime when the task was marked as reviewed by inventory (F3 traceability).
   *  Null when never reviewed or when the task was unmarked. */
  reviewedByInventoryAt?: string | null;

  /** Display name of the operator who last marked the task as reviewed (F3 traceability).
   *  Null when not yet reviewed or traceability not available. */
  reviewedByInventoryUserName?: string | null;

  /** IClass Service Order code — populated by the backend when a task is moved
   *  to the "Enviar a IClass" stage and the OS is created successfully.
   *  Null when the task has never been sent to IClass. */
  iclassOrderCode: string | null;

  /** Originating ticket id — set when the task was created from a ticket.
   *  Populated by the enriched GET /scheduling/:id DTO (tickets-actions-be).
   *  Optional so existing fixtures and the degraded (BE-not-deployed) mode work. */
  ticketId?: number | null;
  /** Snapshot of the originating ticket's subject (tickets-actions-be). */
  ticketSubject?: string | null;

  // Timestamps — backend always returns ISO strings (post-change-1)
  createdAt: string;
  updatedAt: string;
}
