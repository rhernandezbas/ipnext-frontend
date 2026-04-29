export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
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
  customerId: number;
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
