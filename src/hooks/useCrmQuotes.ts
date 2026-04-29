import { useQuery } from '@tanstack/react-query';
import { getCrmQuotes } from '@/api/crmQuote.api';

export function useCrmQuotes() {
  return useQuery({
    queryKey: ['crm-quotes'],
    queryFn: getCrmQuotes,
    staleTime: 60_000,
  });
}
