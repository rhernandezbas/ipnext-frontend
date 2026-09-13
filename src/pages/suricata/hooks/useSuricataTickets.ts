import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSuricataTickets,
  getSuricataAreas,
  getSuricataKpis,
  getSuricataTicketDetail,
  setSuricataAssignee,
  replyToSuricataTicket,
  triggerSuricataSync,
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
 * suricata-tickets-mirror (fix wave, 2026-09-13) — botón "Sincronizar ahora".
 * Invalida lista + KPIs para reflejar el resultado sin esperar el próximo
 * tick automático (15 min).
 */
export function useTriggerSuricataSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerSuricataSync,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suricata-tickets'] });
      qc.invalidateQueries({ queryKey: ['suricata-kpis'] });
    },
  });
}

/**
 * suricata-tickets-mirror (Fase H, tasks H.1, spec UI-2) — the detail view's
 * single fetch: every tab (Conversación/Análisis IA/Datos del cliente) reads
 * from THIS same result, never issuing its own request — that is what makes
 * "switching tabs triggers zero live Suricata calls" (UI-2) true by
 * construction rather than by a per-tab no-op guard. `enabled: !!ticketId`
 * guards the brief render where `useParams()` hasn't resolved `:id` yet.
 */
export function useSuricataTicketDetail(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['suricata-ticket-detail', ticketId],
    queryFn: () => getSuricataTicketDetail(ticketId as string),
    enabled: !!ticketId,
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
    // Fase I, task I.2 — extended to ALSO invalidate the detail query: the
    // detail header's `SuricataAssigneeEditor` (Fase I) reads `assigneeName`
    // from `useSuricataTicketDetail`, and the PATCH response only carries
    // `{id, assigneeId}` (no name) — refetching the detail is what resolves
    // the display name after a save, same criterion as the list invalidation
    // Fase G already had for the list's own assignee column.
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['suricata-tickets'] });
      qc.invalidateQueries({ queryKey: ['suricata-ticket-detail', ticketId] });
    },
  });
}

/**
 * suricata-tickets-mirror (Fase I, task I.1, spec REPLY-1..6, design D10) —
 * `POST /tickets/:id/reply`. Scoped to ONE ticket (molde
 * `useSendStaffTicketReply(ticketId)`) since the composer always lives
 * inside that ticket's Conversation tab. On success, invalidates the
 * detail query — NOT because a reply inserts a mirrored `SuricataMessage`
 * row today (it doesn't; that only happens on the next sync run), but so any
 * future detail change (e.g. an eventual "last reply" field) is picked up
 * without a manual reload, same defensive criterion as the assignee mutation
 * above.
 */
export function useReplySuricataTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, confirm }: { body: string; confirm: string }) =>
      replyToSuricataTicket(ticketId, body, confirm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suricata-ticket-detail', ticketId] });
    },
  });
}
