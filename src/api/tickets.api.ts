import axiosClient from './axios-client';
import type { Ticket, TicketStats, CreateTicketData } from '@/types/ticket';
import type { PaginatedResponse } from '@/types/api';

export interface GetTicketsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedTo?: number;
  customerId?: number;
}

// Aliases used by useTickets hooks
export interface TicketsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
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

export async function getTicketById(id: number): Promise<Ticket> {
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
  // Normalise CreateTicketInput → CreateTicketData when clientId/description are present
  if ('clientId' in data) {
    const payload: CreateTicketData = {
      subject: data.subject,
      message: data.description,
      priority: (data.priority === 'alta' ? 'high' : data.priority === 'media' ? 'medium' : 'low') as CreateTicketData['priority'],
      customerId: Number(data.clientId),
      assignedTo: data.assignedTo ? Number(data.assignedTo) : undefined,
    };
    const response = await axiosClient.post<Ticket>('/tickets', payload);
    return response.data;
  }
  const response = await axiosClient.post<Ticket>('/tickets', data);
  return response.data;
}

export async function updateTicket(
  id: number,
  data: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Ticket> {
  const response = await axiosClient.patch<Ticket>(`/tickets/${id}`, data);
  return response.data;
}

export async function closeTicket(id: number): Promise<Ticket> {
  const response = await axiosClient.post<Ticket>(`/tickets/${id}/close`);
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
