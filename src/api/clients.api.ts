import axiosClient from './axios-client';
import type { Customer, CustomerSummary, Service, LogEntry } from '@/types/customer';
import type { Invoice } from '@/types/billing';
import type { PaginatedResponse } from '@/types/api';

export interface GetClientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
}

// Aliases used by useClients hooks
export type ClientsQuery = GetClientsParams & { limit?: number };
export interface LogsQuery { page?: number; limit?: number; }

export async function getClients(
  params: GetClientsParams = {}
): Promise<PaginatedResponse<CustomerSummary>> {
  const response = await axiosClient.get<PaginatedResponse<CustomerSummary>>('/customers', {
    params,
  });
  return response.data;
}

export async function getClientById(id: number): Promise<Customer> {
  const response = await axiosClient.get<Customer>(`/customers/${id}`);
  return response.data;
}

export async function updateClient(
  id: number,
  data: Partial<Customer>
): Promise<Customer> {
  const response = await axiosClient.patch<Customer>(`/customers/${id}`, data);
  return response.data;
}

export async function createClient(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'services' | 'logs'>
): Promise<Customer> {
  const response = await axiosClient.post<Customer>('/customers', data);
  return response.data;
}

export async function deleteClient(id: number): Promise<void> {
  await axiosClient.delete(`/customers/${id}`);
}

// Alias for hook compatibility (accepts string id)
export async function getClient(id: string): Promise<Customer> {
  return getClientById(Number(id));
}

export async function getClientServices(id: string): Promise<Service[]> {
  const response = await axiosClient.get<Service[]>(`/customers/${id}/services`);
  return response.data;
}

export async function getClientInvoices(id: string): Promise<Invoice[]> {
  const response = await axiosClient.get<Invoice[]>(`/customers/${id}/invoices`);
  return response.data;
}

export async function getClientLogs(id: string, query: LogsQuery): Promise<PaginatedResponse<LogEntry>> {
  const response = await axiosClient.get<PaginatedResponse<LogEntry>>(`/customers/${id}/logs`, {
    params: query,
  });
  return response.data;
}

export interface ClientComment {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CreateCommentPayload {
  clientId: string;
  content: string;
  authorName: string;
}

export async function getClientComments(id: string): Promise<ClientComment[]> {
  const response = await axiosClient.get<ClientComment[]>(`/customers/${id}/comments`);
  return response.data;
}

export async function createClientComment(payload: CreateCommentPayload): Promise<ClientComment> {
  const { clientId, ...body } = payload;
  const response = await axiosClient.post<ClientComment>(`/customers/${clientId}/comments`, body);
  return response.data;
}
