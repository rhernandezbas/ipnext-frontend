import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { auditEventsApi } from '@/api/auditEvents.api';
import type { AuditEventQuery } from '@/types/audit';

export const AUDIT_EVENTS_QUERY_KEY = ['admin', 'audit-events'] as const;

export function useAuditEvents(query: AuditEventQuery = {}) {
  return useQuery({
    queryKey: [...AUDIT_EVENTS_QUERY_KEY, query],
    queryFn: () => auditEventsApi.list(query),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
