import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, getTicketsByCustomer, getTicketStats, createTicket, archiveTicket, hardDeleteTicket, TicketsQuery, CreateTicketInput } from '../api/tickets.api';
import axiosClient from '../api/axios-client';
import type { Ticket, CreateTicketData } from '../types/ticket';

export function useTicketList(query: TicketsQuery) {
  return useQuery({
    queryKey: ['tickets', query],
    queryFn: () => getTickets(query),
    staleTime: 30_000,
  });
}

/** Fetch tickets for a specific customer. Used for the count badge in CustomerDetailPage. */
export function useTicketsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['tickets', { customerId }],
    queryFn: () => getTicketsByCustomer(customerId!),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: ['ticket-stats'],
    queryFn: getTicketStats,
    staleTime: 60_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    // Accepts both the legacy CreateTicketPage shape (CreateTicketInput) and the
    // CreateTicketModal shape (CreateTicketData); the api normalises either one.
    mutationFn: (data: CreateTicketInput | CreateTicketData) => createTicket(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); },
  });
}

export function useTicket(id: string) {
  return useQuery<Ticket>({
    queryKey: ['ticket', id],
    queryFn: () => axiosClient.get(`/tickets/${id}`).then(r => r.data),
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      axiosClient.patch(`/tickets/${id}/status`, { status }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useAssignTicket() {
  const qc = useQueryClient();
  return useMutation({
    // #28 follow-up — the BE has no /assign route (404) and reads `assigneeId`
    // (RbacUser id string) on PATCH /tickets/:id. The legacy call sent
    // `assignedTo: Number(uuid)` = NaN, so assignment never persisted.
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      axiosClient.patch(`/tickets/${id}`, { assigneeId }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// #48 — unified save: PATCH /tickets/:id accepts assigneeId + status + priority
// (plus subject/description) in one request. `description` is the real BE field
// (the legacy `message` never existed in the payload). The BE validates `status`
// against the catalog (422 if unknown).
// #49 — areaId added: string to set, null to clear.
export interface UpdateTicketData {
  subject?: string;
  description?: string;
  priority?: string;
  assigneeId?: string | null;
  status?: string;
  areaId?: string | null;
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketData }) =>
      axiosClient.patch(`/tickets/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axiosClient.delete(`/tickets/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// #85 — archive a ticket (sets archivedAt, moves to archived view).
export function useArchiveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTicket(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); },
  });
}

// #85 — hard-delete a ticket (irreversible). Super-admin only.
export function useHardDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDeleteTicket(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); },
  });
}
