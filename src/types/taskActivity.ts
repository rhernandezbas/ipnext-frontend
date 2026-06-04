/**
 * Task activity feed — mirrors the backend ActivityDto returned by
 * GET /api/scheduling/:id/activity (task-activity-log #10).
 */
export type ActivityType =
  | 'created'
  | 'stage_changed'
  | 'priority_changed'
  | 'category_changed'
  | 'assigned' | 'unassigned'
  | 'reporter_changed'
  | 'contract_changed' | 'customer_changed' | 'partner_changed'
  | 'watcher_added' | 'watcher_removed'
  | 'commented' | 'comment_deleted'
  | 'attachment_added' | 'attachment_removed'
  | 'status_changed'
  | 'due_date_changed'
  | 'description_changed'
  | 'project_changed'
  | 'address_changed'
  | 'estimated_hours_changed'
  | 'travel_time_changed'
  | 'notes_changed'
  | 'inventory_review_changed'
  | 'sent_to_iclass'
  | 'checklist_item_added' | 'checklist_item_removed'
  | 'checklist_item_toggled' | 'checklist_item_updated'
  | 'checklist_reordered'
  | 'checklist_template_assigned'
  | 'checklist_cleared'
  // forward-compat: backend may add types the frontend doesn't know yet
  | (string & {});

export interface ActivityDto {
  id: string;
  taskId: string;
  type: ActivityType;
  actorId: string | null;
  actorName: string;
  fromValue: unknown;
  toValue: unknown;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO 8601
}

export interface ActivityPage {
  items: ActivityDto[];
  nextCursor: string | null;
}
