import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, getTicketStats, createTicket, TicketsQuery, CreateTicketInput } from '../api/tickets.api';
import axiosClient from '../api/axios-client';
import type { Ticket, TicketReply } from '../types/ticket';

export function useTicketList(query: TicketsQuery) {
  return useQuery({
    queryKey: ['tickets', query],
    queryFn: () => getTickets(query),
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
    mutationFn: (data: CreateTicketInput) => createTicket(data),
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

export function useTicketReplies(id: string) {
  return useQuery<TicketReply[]>({
    queryKey: ['ticket-replies', id],
    queryFn: () => axiosClient.get(`/tickets/${id}/replies`).then(r => r.data),
  });
}

export function useAddTicketReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      axiosClient.post(`/tickets/${id}/replies`, { message, authorId: 1, authorName: 'Admin' }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket-replies', id] });
    },
  });
}

export function useAssignTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedTo, assignedToName }: { id: string; assignedTo: number | null; assignedToName: string | null }) =>
      axiosClient.patch(`/tickets/${id}/assign`, { assignedTo, assignedToName }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { subject?: string; message?: string; priority?: string } }) =>
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
