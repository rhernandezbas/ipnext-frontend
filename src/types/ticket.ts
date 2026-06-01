/**
 * Ticket status is catalog-driven (TicketStatus catalog) so it can be any slug
 * the operator defines. The four legacy built-ins are kept in
 * {@link LEGACY_TICKET_STATUSES} for the hardcoded transition fallbacks.
 */
export type TicketStatus = string;

/** The four built-in ticket statuses that predate the catalog. */
export const LEGACY_TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: string | null;
  customerId: number;
  customerName: string;
  assignedTo: number | null;
  assignedToName: string | null;
  reporter: string | null;
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

export interface CreateTicketData {
  subject: string;
  message: string;
  priority: TicketPriority;
  customerId: string;
  assignedTo?: number;
  tags?: string[];
}

export interface TicketReply {
  id: number;
  ticketId: number;
  message: string;
  authorId: number;
  authorName: string;
  createdAt: string;
  isInternal: boolean;
}
