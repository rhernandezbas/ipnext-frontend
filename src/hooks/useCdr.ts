import { useQuery } from '@tanstack/react-query';
import type { CdrRecord } from '@/types/cdr';
import * as api from '@/api/cdr.api';

export function useCdrRecords() {
  return useQuery<CdrRecord[]>({ queryKey: ['cdr-records'], queryFn: api.getCdrRecords });
}
