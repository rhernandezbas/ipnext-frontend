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
  customerName: string | null;
  customerPhone: string | null;
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

/**
 * suricata-tickets-mirror (Fase H, tasks H.1..H.4, design D13) — detail wire
 * shapes, mirror of `ipnext-backend/src/application/dto/suricata.dto.ts`'s
 * `SuricataTicketDetailDto` (Fase F/H). Read from the BE worktree's real
 * DTO/domain files, same criterion as Fase G's list shapes.
 *
 * `authorKind` mirrors the BE's real domain enum
 * (`domain/entities/suricata.ts`'s `SuricataMessageAuthorKind`) —
 * `'customer' | 'agent' | 'system' | 'unknown'`. There is NO dedicated `'bot'`
 * value in the real contract (the approved mockup's 3-lane cliente/bot/staff
 * sketch assumed one that does not exist on the wire) — the Conversation tab
 * derives its lanes from these 4 real values instead (deviation, see the
 * apply-phase report).
 */
export type SuricataMessageAuthorKind = 'customer' | 'agent' | 'system' | 'unknown';
export type SuricataAttachmentStatus = 'pending' | 'stored' | 'failed';

export interface SuricataMessageDto {
  id: string;
  author: string;
  authorKind: SuricataMessageAuthorKind;
  body: string;
  sentAt: string;
}

export interface SuricataAttachmentDto {
  id: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  status: SuricataAttachmentStatus;
}

/** D9 — `stale` is a DERIVED field (ticket content changed since this verdict). */
export interface SuricataVerdictDto {
  id: string;
  resuelto: boolean;
  analisis: string;
  motivo: string | null;
  respuestaSugerida: string | null;
  createdAt: string;
  stale: boolean;
}

/** GET /api/suricata/tickets/:id (UI-2..UI-5) — mirror-only, zero live Suricata calls. */
export interface SuricataTicketDetailDto {
  id: string;
  externalId: string;
  subject: string;
  status: string;
  priority: string | null;
  areaId: string | null;
  areaName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  externalClientRef: string | null;
  clientId: string | null;
  botState: SuricataBotState;
  assigneeId: string | null;
  assigneeName: string | null;
  openedAt: string | null;
  lastMessageAt: string | null;
  syncedAt: string;
  /** Ordered oldest → newest (Conversation tab timeline, UI-3). */
  messages: SuricataMessageDto[];
  attachments: SuricataAttachmentDto[];
  /** Ordered newest → oldest — `verdicts[0]` is the current one (UI-4). */
  verdicts: SuricataVerdictDto[];
}

export async function getSuricataTicketDetail(ticketId: string): Promise<SuricataTicketDetailDto> {
  const response = await axiosClient.get<SuricataTicketDetailDto>(`/suricata/tickets/${ticketId}`);
  return response.data;
}

/**
 * D7.c (internal mirror, Fase H gap fix in the BE worktree) — same-origin
 * BE-proxy for an attachment's binary content, gated by session +
 * `suricata.read`. Never a signed URL: `axiosClient`'s `baseURL: '/api'` is
 * same-origin, so the browser sends the session cookie automatically for a
 * plain `<audio src>`/`<a href>`, same convention as
 * `TicketMessageAttachmentView`'s BE-proxied media.
 */
export function getSuricataAttachmentContentUrl(ticketId: string, attachmentId: string): string {
  return `/api/suricata/tickets/${ticketId}/attachments/${attachmentId}/content`;
}
