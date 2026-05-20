/** @deprecated use stageCategory; will be removed next change */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
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
}
