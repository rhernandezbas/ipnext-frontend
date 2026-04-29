import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClients,
  getClient,
  getClientServices,
  getClientInvoices,
  getClientLogs,
  getClientComments,
  createClientComment,
} from '../api/clients.api';
import axiosClient from '../api/axios-client';
import type { ClientsQuery, LogsQuery, ClientComment, CreateCommentPayload } from '../api/clients.api';
import type { CreateCustomerData, UpdateCustomerData, AddServiceData, UpdateServiceData } from '../types/customer';

export type { ClientsQuery, LogsQuery, ClientComment };

export function useClientList(query: ClientsQuery) {
  return useQuery({
    queryKey: ['clients', query],
    queryFn: () => getClients(query),
    staleTime: 30_000,
  });
}

export function useClientDetail(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id),
    staleTime: 60_000,
    enabled: !!id,
  });
}

export function useClientServices(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['client-services', id],
    queryFn: () => getClientServices(id),
    staleTime: 60_000,
    enabled,
  });
}

export function useClientInvoices(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['client-invoices', id],
    queryFn: () => getClientInvoices(id),
    staleTime: 60_000,
    enabled,
  });
}

export function useClientLogs(id: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['client-logs', id, page],
    queryFn: () => getClientLogs(id, { page, limit: 25 }),
    staleTime: 30_000,
    enabled,
  });
}

export function useClientComments(id: string) {
  return useQuery({
    queryKey: ['client-comments', id],
    queryFn: () => getClientComments(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => createClientComment(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['client-comments', variables.clientId] });
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerData) =>
      axiosClient.post('/clients', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerData }) =>
      axiosClient.patch(`/clients/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}

export function useToggleClientStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      axiosClient.patch(`/clients/${id}/status`, { status }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}

export interface ClientDocument {
  id: number;
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
}

export function useClientDocuments(clientId: string) {
  return useQuery<ClientDocument[]>({
    queryKey: ['client-docs', clientId],
    queryFn: () => axiosClient.get(`/clients/${clientId}/documents`).then(r => r.data),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, name, size }: { clientId: string; name: string; size: number }) =>
      axiosClient.post(`/clients/${clientId}/documents`, { name, size }).then(r => r.data),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-docs', clientId] });
    },
  });
}

export function useAddService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: AddServiceData }) =>
      axiosClient.post(`/clients/${clientId}/services`, data).then(r => r.data),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-services', clientId] });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, serviceId, data }: { clientId: string; serviceId: number; data: UpdateServiceData }) =>
      axiosClient.patch(`/clients/${clientId}/services/${serviceId}`, data).then(r => r.data),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-services', clientId] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, serviceId }: { clientId: string; serviceId: number }) =>
      axiosClient.delete(`/clients/${clientId}/services/${serviceId}`).then(r => r.data),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-services', clientId] });
    },
  });
}

export interface ClientFile {
  id: number;
  name: string;
  size: number;
  uploadedAt: string;
}

export function useClientFiles(clientId: string) {
  return useQuery<ClientFile[]>({
    queryKey: ['client-files', clientId],
    queryFn: () => axiosClient.get(`/clients/${clientId}/files`).then(r => r.data),
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, name, size }: { clientId: string; name: string; size: number }) =>
      axiosClient.post(`/clients/${clientId}/files`, { name, size }).then(r => r.data),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-files', clientId] });
    },
  });
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

export function useOnlineSessions() {
  return useQuery<OnlineSession[]>({
    queryKey: ['online-sessions'],
    queryFn: () => axiosClient.get('/clients/online').then(r => r.data),
    refetchInterval: 30000,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      axiosClient.delete(`/clients/online/${sessionId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['online-sessions'] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axiosClient.delete(`/clients/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
