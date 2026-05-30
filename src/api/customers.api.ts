import axiosClient from './axios-client';
import type { Customer, CustomerSummary, Service, LogEntry, CreateCustomerData, UpdateCustomerData, AddServiceData, UpdateServiceData } from '@/types/customer';
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
  const response = await axiosClient.get<PaginatedResponse<CustomerSummary>>('/clients', {
    params,
  });
  return response.data;
}

// Accepts either a numeric legacy ID or a Prisma UUID — backend route just uses the string.
export async function getClientById(id: number | string): Promise<Customer> {
  const response = await axiosClient.get<Customer>(`/clients/${id}`);
  return response.data;
}

export interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  late: number;
  baja: number;
}

export async function getClientStats(): Promise<ClientStats> {
  const response = await axiosClient.get<ClientStats>('/clients/stats');
  return response.data;
}

export async function updateClient(
  id: number,
  data: Partial<Customer>
): Promise<Customer> {
  const response = await axiosClient.patch<Customer>(`/clients/${id}`, data);
  return response.data;
}

export async function createClient(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'services' | 'logs'>
): Promise<Customer> {
  const response = await axiosClient.post<Customer>('/clients', data);
  return response.data;
}

export async function deleteClient(id: number): Promise<void> {
  await axiosClient.delete(`/clients/${id}`);
}

// Alias for hook compatibility (accepts string id — UUID or legacy numeric).
// IMPORTANT: do NOT do Number(id) — Prisma UUIDs become NaN and the GET 404s,
// rendering "Cliente no encontrado" in the detail page.
export async function getClient(id: string): Promise<Customer> {
  return getClientById(id);
}

export async function getClientServices(id: string): Promise<Service[]> {
  const response = await axiosClient.get<Service[]>(`/clients/${id}/services`);
  return response.data;
}

export async function getClientInvoices(id: string): Promise<Invoice[]> {
  const response = await axiosClient.get<Invoice[]>(`/clients/${id}/invoices`);
  return response.data;
}

export async function getClientLogs(id: string, query: LogsQuery): Promise<PaginatedResponse<LogEntry>> {
  const response = await axiosClient.get<PaginatedResponse<LogEntry>>(`/clients/${id}/logs`, {
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

export async function createCustomer(data: CreateCustomerData): Promise<Customer> {
  const response = await axiosClient.post<Customer>('/clients', data);
  return response.data;
}

export async function patchClient(id: string, data: UpdateCustomerData): Promise<Customer> {
  const response = await axiosClient.patch<Customer>(`/clients/${id}`, data);
  return response.data;
}

export async function updateClientStatus(id: string, status: string): Promise<Customer> {
  const response = await axiosClient.patch<Customer>(`/clients/${id}/status`, { status });
  return response.data;
}

export interface ClientDocument {
  id: number;
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
}

export async function getClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const response = await axiosClient.get<ClientDocument[]>(`/clients/${clientId}/documents`);
  return response.data;
}

export async function uploadClientDocument(
  clientId: string,
  name: string,
  size: number
): Promise<ClientDocument> {
  const response = await axiosClient.post<ClientDocument>(`/clients/${clientId}/documents`, { name, size });
  return response.data;
}

export async function addClientService(clientId: string, data: AddServiceData): Promise<Service> {
  const response = await axiosClient.post<Service>(`/clients/${clientId}/services`, data);
  return response.data;
}

export async function updateClientService(
  clientId: string,
  serviceId: number,
  data: UpdateServiceData
): Promise<Service> {
  const response = await axiosClient.patch<Service>(`/clients/${clientId}/services/${serviceId}`, data);
  return response.data;
}

export async function deleteClientService(clientId: string, serviceId: number): Promise<void> {
  await axiosClient.delete(`/clients/${clientId}/services/${serviceId}`);
}

export interface ClientFile {
  id: number;
  name: string;
  size: number;
  uploadedAt: string;
}

export async function getClientFiles(clientId: string): Promise<ClientFile[]> {
  const response = await axiosClient.get<ClientFile[]>(`/clients/${clientId}/files`);
  return response.data;
}

export async function uploadClientFile(
  clientId: string,
  name: string,
  size: number
): Promise<ClientFile> {
  const response = await axiosClient.post<ClientFile>(`/clients/${clientId}/files`, { name, size });
  return response.data;
}

export interface OnlineSession {
  id: number;
  clientId: number;
  clientName: string;
  ip: string;
  mac: string;
  connectedSince: string;
  downloadMbps: number;
  uploadMbps: number;
}

export async function getOnlineSessions(): Promise<OnlineSession[]> {
  const response = await axiosClient.get<OnlineSession[]>('/clients/online');
  return response.data;
}

export async function disconnectSession(sessionId: number): Promise<void> {
  await axiosClient.delete(`/clients/online/${sessionId}`);
}

export async function deleteCustomer(id: string): Promise<void> {
  await axiosClient.delete(`/clients/${id}`);
}
