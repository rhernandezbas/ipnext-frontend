import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketSlaConfigApi } from '@/api/ticketSlaConfig.api';

const KEY = ['ticket-sla-config'] as const;

/** #79 — Read the SLA timer thresholds. staleTime keeps the list from refetching
 *  on every render; the thresholds change rarely (only from the settings page). */
export function useTicketSlaConfig() {
  return useQuery({ queryKey: KEY, queryFn: ticketSlaConfigApi.get, staleTime: 300_000 });
}

export function useUpdateTicketSlaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ticketSlaConfigApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
