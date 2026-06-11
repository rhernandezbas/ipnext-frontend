import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddTicketCommentInput } from '@/types/ticketComments';
import * as api from '@/api/ticketComments.api';

const queryKey = (ticketId: string) => ['ticket-comments', ticketId] as const;

export function useTicketComments(ticketId: string) {
  return useQuery({
    queryKey: queryKey(ticketId),
    queryFn: () => api.listTicketComments(ticketId),
    enabled: !!ticketId,
  });
}

export function useAddTicketComment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddTicketCommentInput) => api.addTicketComment(input),
    onSuccess: () => {
      // Tickets have no activity feed (#44) — invalidate only the comments key.
      void qc.invalidateQueries({ queryKey: queryKey(ticketId) });
    },
  });
}
