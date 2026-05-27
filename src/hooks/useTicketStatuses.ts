import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketStatusesApi } from '@/api/ticketStatuses.api';

const KEY = ['ticket-statuses'] as const;

export function useTicketStatuses() {
  return useQuery({ queryKey: KEY, queryFn: ticketStatusesApi.list, staleTime: 60_000 });
}

export function useCreateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ticketStatusesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string; weight?: number } }) =>
      ticketStatusesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketStatusesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
