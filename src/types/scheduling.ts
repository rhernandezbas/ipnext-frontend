// ── General status (#41) ─────────────────────────────────────────────────────
/** Task general status. `generalStatus` is the source of truth; `isClosed` is a
 *  derived facade (`isClosed === (generalStatus === 'closed')`). */
export type TaskGeneralStatus = 'open' | 'closed' | 'dismissed';

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
  /** Task kind — 'customer' or 'network' (#40). Page constant on the Nodos page,
   *  not URL state. Omitted ⇒ backend returns all kinds. */
  kind?:       'customer' | 'network';
  /** General-status filter (#41). 'all' returns open + closed + dismissed.
   *  The FE always sends an explicit value (default 'open'); omitting it is a
   *  BE back-compat contract for non-FE callers (omitted ≡ all). */
  status?:     TaskGeneralStatus | 'all';
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
  ticketId?: string | null;
  /** Task kind — 'customer' (default) or 'network' (node-based task). */
  kind?: 'customer' | 'network';
  /** Network site id — required when kind === 'network'. */
  networkSiteId?: string | null;
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
// #27 — the legacy TaskPriority union (low/normal/high/urgent) was removed:
// priority is free text backed by the TaskPriority CATALOG (Baja/Normal/Alta/
// Urgente, editable). Validating against the old union silently dropped every
// real value. Use `string` + the catalog from useTaskPriorities.
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

  /** General status (#41) — source of truth for open / closed / dismissed.
   *  Set via POST /scheduling/:id/status. `isClosed` is derived from this. */
  generalStatus: TaskGeneralStatus;

  /** Closed flag — derived facade over `generalStatus` (`=== 'closed'`).
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

  /** Task kind — discriminates between customer tasks and network-node tasks. */
  kind: 'customer' | 'network';

  /** Network site id — populated when kind === 'network'. */
  networkSiteId: string | null;

  /** Network site display name (JOIN-derived) — populated when kind === 'network'. */
  networkSiteName: string | null;

  /** Originating ticket id — set when the task was created from a ticket.
   *  Populated by the enriched GET /scheduling/:id DTO (tickets-actions-be).
   *  Optional so existing fixtures and the degraded (BE-not-deployed) mode work. */
  ticketId?: string | null;
  /** Snapshot of the originating ticket's subject (tickets-actions-be). */
  ticketSubject?: string | null;

  /** Whether the task's project has the retirement feature enabled (#39).
   *  Populated by the enriched GET /scheduling/:id DTO.
   *  Optional for back-compat with tasks that pre-date #39. */
  projectAllowsRetirement?: boolean;

  // Timestamps — backend always returns ISO strings (post-change-1)
  createdAt: string;
  updatedAt: string;
}
