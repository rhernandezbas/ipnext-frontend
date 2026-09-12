import axiosClient from '@/api/axios-client';

/**
 * suricata-tickets-mirror (Fase G, tasks G.2, design D13) — typed client for
 * the Prominense panel's read routes. Field names mirror
 * `ipnext-backend/src/application/dto/suricata.dto.ts` 1:1 (D13.a: "tipos
 * espejo campo-a-campo del DTO; la validación en cliente es UX, la autoridad
 * es el BE"). Never re-derive shapes from the mockup — the wire contract is
 * D13's block, read from the BE worktree's real DTO file.
 */

/** Mirrors `SuricataBotState` (BE `domain/entities/suricataBotState.ts`). */
export type SuricataBotState = 'sin_analizar' | 'resuelto_bot' | 'requiere_humano' | 'stale';

export interface SuricataAreaDto {
  id: string;
  name: string;
  active: boolean;
}

export interface SuricataTicketListItemDto {
  id: string;
  externalId: string;
  subject: string;
  status: string;
  priority: string | null;
  areaId: string | null;
  areaName: string | null;
  botState: SuricataBotState;
  assigneeId: string | null;
  assigneeName: string | null;
  lastMessageAt: string | null;
  syncedAt: string;
}

export interface SuricataTicketsFilters {
  status?: string;
  priority?: string;
  areaId?: string;
  assigneeId?: string;
  botState?: SuricataBotState;
}

export interface SuricataTicketsQuery extends SuricataTicketsFilters {
  page?: number;
  limit?: number;
}

/** GET /api/suricata/tickets response shape (page/limit, NOT pageSize/totalPages —
 *  this endpoint does not follow the generic `PaginatedResponse<T>` shape). */
export interface SuricataTicketsResultDto {
  data: SuricataTicketListItemDto[];
  total: number;
  page: number;
  limit: number;
}

/** GET /api/suricata/kpis response shape (UI-6). Percentages are already
 *  computed server-side over `total` — never recompute them client-side. */
export interface SuricataKpisDto {
  total: number;
  resueltoBotPct: number;
  requiereHumanoPct: number;
  sinVeredictoPct: number;
  staleCount: number;
  sincronizadosHoy: number;
}

export async function getSuricataTickets(
  query: SuricataTicketsQuery = {},
): Promise<SuricataTicketsResultDto> {
  const response = await axiosClient.get<SuricataTicketsResultDto>('/suricata/tickets', {
    params: query,
  });
  return response.data;
}

export async function getSuricataAreas(): Promise<SuricataAreaDto[]> {
  const response = await axiosClient.get<SuricataAreaDto[]>('/suricata/areas');
  return response.data;
}

export async function getSuricataKpis(): Promise<SuricataKpisDto> {
  const response = await axiosClient.get<SuricataKpisDto>('/suricata/kpis');
  return response.data;
}

/**
 * UI-7 — PATCH assignee. Prominense-only: the BE route never forwards this
 * write to Suricata. Kept in this Fase G client for reuse by the detail view
 * (Fase I, task I.2) so the wire contract lives in a single place.
 */
export async function setSuricataAssignee(
  ticketId: string,
  assigneeId: string | null,
): Promise<{ id: string; assigneeId: string | null }> {
  const response = await axiosClient.patch<{ id: string; assigneeId: string | null }>(
    `/suricata/tickets/${ticketId}/assignee`,
    { assigneeId },
  );
  return response.data;
}
