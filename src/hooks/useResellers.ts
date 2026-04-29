import { useQuery } from '@tanstack/react-query';
import type { Reseller } from '@/types/reseller';
import * as api from '@/api/reseller.api';

export function useResellers() {
  return useQuery<Reseller[]>({ queryKey: ['resellers'], queryFn: api.getResellers });
}

export function useResellerDetail(id: string) {
  return useQuery<Reseller | undefined>({
    queryKey: ['reseller', id],
    queryFn: () => api.getResellerById(id),
    enabled: !!id,
  });
}
