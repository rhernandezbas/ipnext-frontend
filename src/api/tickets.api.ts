import axiosClient from './axios-client';
import type { Ticket, TicketStats, CreateTicketData } from '@/types/ticket';
import type { PaginatedResponse } from '@/types/api';
import type { ScheduledTask, CreateTaskPayload } from '@/types/scheduling';

export interface GetTicketsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedTo?: number;
  customerId?: string;
}

// Aliases used by useTickets hooks
export interface TicketsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  customerId?: string;
  assignedTo?: string;   // #25 — filtra por asignado (el BE lo mapea a assigneeId)
  from?: string;         // #25 — createdAt >=
  to?: string;           // #25 — createdAt <=
  areaId?: string;       // #49 — filtra por area
}

export interface CreateTicketInput {
  subject: string;
  clientId: string;
  priority: 'alta' | 'media' | 'baja';
  description: string;
  assignedTo?: string;
}

export async function getTickets(
  params: GetTicketsParams | TicketsQuery = {}
): Promise<PaginatedResponse<Ticket>> {
  // Normalise limit → pageSize for the API
  const { limit, ...rest } = params as TicketsQuery & GetTicketsParams;
  const normalisedParams = limit !== undefined ? { pageSize: limit, ...rest } : rest;
  const response = await axiosClient.get<PaginatedResponse<Ticket>>('/tickets', { params: normalisedParams });
  return response.data;
}

export async function getTicketById(id: string): Promise<Ticket> {
  const response = await axiosClient.get<Ticket>(`/tickets/${id}`);
  return response.data;
}

export async function getTicketStats(): Promise<TicketStats> {
  const response = await axiosClient.get<TicketStats>('/tickets/stats');
  return response.data;
}

export function getMockTicketStats(): TicketStats {
  return {
    open: 12,
    pending: 5,
    resolved: 28,
    closed: 14,
    total: 59,
    avgResolutionTimeHours: 6.5,
    closedToday: 4,
    avgResolutionTime: '6h 30m',
    unassigned: 3,
  };
}

export async function createTicket(data: CreateTicketData | CreateTicketInput): Promise<Ticket> {
  // Normalise CreateTicketInput → CreateTicketData when clientId/description are present.
  // #28 follow-up — the BE body is { description, assigneeId }: `message` got a 400
  // (missing description) and `Number(assignedTo)` was NaN for RbacUser uuid ids.
  if ('clientId' in data) {
    // Legacy CreateTicketInput path (CreateTicketPage). areaId not available here
    // — the legacy form predates #49. The BE will 422 if areaId is absent, but
    // CreateTicketPage is separate from the modal and must be updated by its owner.
    const payload = {
      subject: data.subject,
      description: data.description,
      priority: (data.priority === 'alta' ? 'high' : data.priority === 'media' ? 'medium' : 'low') as CreateTicketData['priority'],
      customerId: data.clientId,
      assigneeId: data.assignedTo || undefined,
    };
    const response = await axiosClient.post<Ticket>('/tickets', payload);
    return response.data;
  }
  const response = await axiosClient.post<Ticket>('/tickets', data);
  return response.data;
}

/**
 * Create a ScheduledTask FROM a ticket. The ticket id binds via the PATH
 * (`POST /tickets/:id/tasks`), not the body (AD-7: not body-overridable), so the
 * created task gets `ticketId` persisted. Returns the created task (with `id`).
 */
export async function createTaskFromTicket(
  ticketId: string,
  body: CreateTaskPayload
): Promise<ScheduledTask> {
  const response = await axiosClient.post<ScheduledTask>(`/tickets/${ticketId}/tasks`, body);
  return response.data;
}

export async function updateTicket(
  id: string,
  data: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Ticket> {
  const response = await axiosClient.patch<Ticket>(`/tickets/${id}`, data);
  return response.data;
}

export async function getArchivedTickets(
  params: GetTicketsParams = {}
): Promise<PaginatedResponse<Ticket>> {
  const response = await axiosClient.get<PaginatedResponse<Ticket>>('/tickets/archive', {
    params,
  });
  return response.data;
}

/** Fetch all tickets for a specific customer — used for the count badge in CustomerDetailPage. */
export async function getTicketsByCustomer(
  customerId: string | number
): Promise<PaginatedResponse<Ticket>> {
  const response = await axiosClient.get<PaginatedResponse<Ticket>>('/tickets', {
    params: { customerId: String(customerId), pageSize: 1000 },
  });
  return response.data;
}
