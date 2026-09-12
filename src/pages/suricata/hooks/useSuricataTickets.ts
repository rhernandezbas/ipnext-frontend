import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSuricataTickets,
  getSuricataAreas,
  getSuricataKpis,
  setSuricataAssignee,
  type SuricataTicketsQuery,
} from '../api/suricataClient';

/**
 * suricata-tickets-mirror (Fase G, tasks G.2/G.3/G.4) — TanStack Query hooks
 * for the panel's read routes, molde `useTickets.ts`.
 */

export function useSuricataTickets(query: SuricataTicketsQuery) {
  return useQuery({
    queryKey: ['suricata-tickets', query],
    queryFn: () => getSuricataTickets(query),
    staleTime: 30_000,
  });
}

export function useSuricataAreas() {
  return useQuery({
    queryKey: ['suricata-areas'],
    queryFn: getSuricataAreas,
    staleTime: 5 * 60_000,
  });
}

export function useSuricataKpis() {
  return useQuery({
    queryKey: ['suricata-kpis'],
    queryFn: getSuricataKpis,
    staleTime: 30_000,
  });
}

/**
 * UI-7 — Prominense-only assignment mutation. Not wired into any editable
 * control in Fase G's list (the mockup and design D13.a only show an
 * editable assignment field in the DETAIL header — Fase I, task I.2). Kept
 * here so the wire contract has one owner and Fase I reuses it as-is.
 */
export function useSetSuricataAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string | null }) =>
      setSuricataAssignee(ticketId, assigneeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suricata-tickets'] });
    },
  });
}
