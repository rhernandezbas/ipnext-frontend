import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketAreasApi } from '@/api/ticketAreas.api';

const KEY = ['ticket-areas'] as const;

export function useTicketAreas() {
  return useQuery({ queryKey: KEY, queryFn: ticketAreasApi.list, staleTime: 60_000 });
}

export function useCreateTicketArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ticketAreasApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTicketArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      ticketAreasApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTicketArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketAreasApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
