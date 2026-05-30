import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { sessionsApi } from '@/api/sessions.api';
import type { SessionQuery } from '@/types/session';

export const SESSIONS_QUERY_KEY = ['admin', 'sessions'] as const;

export function useActiveSessions(query: SessionQuery = {}) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, query],
    queryFn: () => sessionsApi.list(query),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => sessionsApi.revokeAllForUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });
}
