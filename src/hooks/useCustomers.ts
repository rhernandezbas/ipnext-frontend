import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClients,
  getClient,
  getClientContracts,
  getClientInvoices,
  getClientLogs,
  getClientComments,
  createClientComment,
  getClientStats,
  createCustomer,
  patchClient,
  updateClientStatus,
  getClientDocuments,
  uploadClientDocument,
  patchContractName,
  getClientFiles,
  uploadClientFile,
  getOnlineSessions,
  disconnectSession,
  deleteCustomer,
} from '../api/customers.api';
import type {
  ClientsQuery,
  LogsQuery,
  ClientComment,
  CreateCommentPayload,
  ClientDocument,
  ClientFile,
  OnlineSession,
} from '../api/customers.api';
import type { CreateCustomerData, UpdateCustomerData } from '../types/customer';

export type { ClientsQuery, LogsQuery, ClientComment, ClientDocument, ClientFile, OnlineSession };

export function useClientList(query: ClientsQuery) {
  return useQuery({
    queryKey: ['clients', query],
    queryFn: () => getClients(query),
    staleTime: 30_000,
    // Live-mirror feel: poll the local DB so GR-synced changes surface on their own.
    refetchInterval: 30_000,
  });
}

export function useClientStats() {
  return useQuery({
    queryKey: ['client-stats'],
    queryFn: getClientStats,
    staleTime: 60_000,
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

export function useClientContracts(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['client-contracts', id],
    queryFn: () => getClientContracts(id),
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
    mutationFn: (data: CreateCustomerData) => createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerData }) => patchClient(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}

export function useToggleClientStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateClientStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}

export function useClientDocuments(clientId: string) {
  return useQuery<ClientDocument[]>({
    queryKey: ['client-docs', clientId],
    queryFn: () => getClientDocuments(clientId),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, name, size }: { clientId: string; name: string; size: number }) =>
      uploadClientDocument(clientId, name, size),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-docs', clientId] });
    },
  });
}

/**
 * Rename a contract (#43). Invalidates the client-contracts list so the new
 * name surfaces. The contract id is a UUID string, used verbatim.
 */
export function useUpdateContractName(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, name }: { contractId: string; name: string | null }) =>
      patchContractName(contractId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', clientId] });
    },
  });
}

export function useClientFiles(clientId: string) {
  return useQuery<ClientFile[]>({
    queryKey: ['client-files', clientId],
    queryFn: () => getClientFiles(clientId),
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, name, size }: { clientId: string; name: string; size: number }) =>
      uploadClientFile(clientId, name, size),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['client-files', clientId] });
    },
  });
}

export function useOnlineSessions() {
  return useQuery<OnlineSession[]>({
    queryKey: ['online-sessions'],
    queryFn: () => getOnlineSessions(),
    refetchInterval: 30000,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => disconnectSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['online-sessions'] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
