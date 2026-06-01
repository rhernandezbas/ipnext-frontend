import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { sessionsApi } from '@/api/sessions.api';
import type { SessionQuery } from '@/types/session';

export const SESSIONS_QUERY_KEY = ['admin', 'sessions'] as const;
export const SESSION_HISTORY_QUERY_KEY = ['admin', 'sessions', 'history'] as const;

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

export function useSessionHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...SESSION_HISTORY_QUERY_KEY, { page, pageSize }],
    queryFn: () => sessionsApi.getHistory(page, pageSize),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
