import { useQuery } from '@tanstack/react-query';
import { getTicketRequesters } from '@/api/ticketRequester.api';

export function useTicketRequesters() {
  return useQuery({
    queryKey: ['ticket-requesters'],
    queryFn: getTicketRequesters,
    staleTime: 60_000,
  });
}
