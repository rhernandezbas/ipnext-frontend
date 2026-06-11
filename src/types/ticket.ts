/**
 * Ticket status is catalog-driven (TicketStatus catalog) so it can be any slug
 * the operator defines. The four legacy built-ins are kept in
 * {@link LEGACY_TICKET_STATUSES} for the hardcoded transition fallbacks.
 */
export type TicketStatus = string;

/** The four built-in ticket statuses that predate the catalog. */
export const LEGACY_TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/** A ScheduledTask created from this ticket — surfaced in the Relacionado tab.
 *  Comes from the enriched GET /tickets/:id payload (#44). */
export interface RelatedTask {
  id: string;
  sequenceNumber: number;
  title: string;
}

export interface Ticket {
  id: string;                    // #44 — was number; the BE id is a UUID
  sequenceNumber: number;        // #11 — monotonic display number (#N), like tasks
  subject: string;
  description: string;           // #28 follow-up — the BE field is `description`, not `message`
  status: TicketStatus;
  priority: TicketPriority;
  type: string | null;
  customerId: string;
  customerName: string;
  // #28 follow-up — the BE returns `assigneeId` (RbacUser id, string) and
  // `assigneeName`; the legacy `assignedTo:number`/`assignedToName` never existed
  // in the real payload, so assignment rendered empty everywhere.
  assigneeId: string | null;
  assigneeName: string | null;
  reporter: string | null;
  /** ScheduledTasks created from this ticket (#44 — enriched GET /tickets/:id). */
  tasks?: RelatedTask[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  tags: string[];
}

export interface TicketStats {
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  total: number;
  avgResolutionTimeHours: number;
  closedToday: number;
  avgResolutionTime: string;
  unassigned: number;
}

// #28 follow-up — wire shape of POST /tickets: the BE requires `description`
// (400 without it) and reads `assigneeId` (RbacUser id string).
export interface CreateTicketData {
  subject: string;
  description: string;
  priority: TicketPriority;
  customerId: string | null;
  assigneeId?: string;
  tags?: string[];
}
