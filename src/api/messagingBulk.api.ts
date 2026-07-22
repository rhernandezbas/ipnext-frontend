import axiosClient from './axios-client';
import type {
  CampaignSummaryDto,
  ChatwootLabelDto,
  CreateCampaignInput,
  CreateCampaignOutput,
  CreateChatwootLabelInput,
  ExcludedRecipientsOutput,
  GetCampaignOutput,
  GetCampaignQuery,
  PaginatedQuery,
  PaginatedResult,
  PreviewSegmentInput,
  PreviewSegmentOutput,
  SegmentRecipientsOutput,
  SegmentRecipientsQuery,
  SendCampaignOutput,
  TemplateSummaryDto,
} from '@/types/messagingBulk';

/**
 * messagingBulk.api (F2, apply chunk 1) — cliente del router
 * `/api/messaging/bulk` (montado relativo a ese prefijo en `app.ts` — las
 * rutas de acá abajo son relativas a `/messaging/bulk`, ver
 * `messagingBulk.routes.ts` real, NO el boceto de design.md).
 *
 * OJO envelope ASIMETRICO por endpoint (verificado contra el código real):
 * - GET  /templates          → `res.json({data})`               → UNWRAP `.data.data`
 * - POST /segment/preview    → `res.json(result)`                → flat
 * - POST /campaigns          → `res.status(201).json(result)`    → flat
 * - POST /campaigns/:id/send → `res.status(202).json({...})`     → flat
 *                               (409 CAMPAIGN_SEND_IN_PROGRESS: axios lo
 *                               rechaza como error — lo maneja el hook,
 *                               no acá)
 * - GET  /campaigns/:id      → `res.json(result)`                → flat ({campaign, recipients?})
 * - GET  /campaigns          → `res.json(result)`                → flat (PaginatedResult<CampaignSummaryDto>)
 *
 * NOTA: el BE también expone `GET /segment/preview` (mismo use case, input
 * por query-params en vez de body — pensado para bookmarks/deep-links). El
 * composer F2 es de 1-página sin deep-linking (decisión LOCKED), así que acá
 * solo se cablea el POST (el preview es on-demand vía mutation, no
 * navegable); se documenta para que quede claro que el GET no es un olvido.
 */

const BASE = '/messaging/bulk';

export const listBulkTemplates = (): Promise<TemplateSummaryDto[]> =>
  axiosClient.get<{ data: TemplateSummaryDto[] }>(`${BASE}/templates`).then((r) => r.data.data);

/**
 * campaign-chatwoot-label (D5.b BE) — catálogo de etiquetas de Chatwoot.
 * Envelope `{data}` (mismo criterio que `listBulkTemplates` — UNWRAP
 * `.data.data`, memoria `e2e-envelope-mock-mismatch`). Gate BE `messaging.templates`.
 */
export const listChatwootLabels = (): Promise<ChatwootLabelDto[]> =>
  axiosClient.get<{ data: ChatwootLabelDto[] }>(`${BASE}/chatwoot-labels`).then((r) => r.data.data);

/**
 * campaign-chatwoot-label (D5.b BE) — crea una etiqueta en el catálogo de
 * Chatwoot. `res.status(201).json(dto)` → FLAT (sin envelope, mismo criterio
 * que `createCampaign`). Gate BE `messaging.manage` (tier supervisor).
 */
export const createChatwootLabel = (input: CreateChatwootLabelInput): Promise<ChatwootLabelDto> =>
  axiosClient.post<ChatwootLabelDto>(`${BASE}/chatwoot-labels`, input).then((r) => r.data);

export const previewSegment = (input: PreviewSegmentInput): Promise<PreviewSegmentOutput> =>
  axiosClient.post<PreviewSegmentOutput>(`${BASE}/segment/preview`, input).then((r) => r.data);

/**
 * v1.1 (BE en PROD) — recipients PAGINADOS del segmento (a diferencia de
 * `previewSegment`, que trunca a una muestra de 20). Mismo criterio de
 * envelope que `previewSegment` (FLAT, sin `{data}` de por medio — el `data`
 * de acá es el campo real del `PaginatedResult`, no un envelope).
 *
 * bulk-csv-recipients (CSV-FE-6, D11) — el `query` es el input COMPLETO
 * (segmento + `manualClientIds`? + `manualContacts`? + página/límite): a
 * diferencia de la v1.1 anterior (sólo segmento), `PreviewModal` ahora pide
 * la UNIÓN completa de las 3 fuentes en una sola llamada — un objeto, no
 * argumentos posicionales (mismo molde que `previewSegment`).
 *
 * El BE también expone el GET equivalente (deep-links, SOLO segmento — ver
 * design D11) — el composer sigue siendo de 1-página sin deep-linking, así
 * que acá solo se cablea el POST (mismo criterio documentado arriba para
 * `previewSegment`).
 */
export const listSegmentRecipients = (query: SegmentRecipientsQuery): Promise<SegmentRecipientsOutput> =>
  axiosClient.post<SegmentRecipientsOutput>(`${BASE}/segment/recipients`, query).then((r) => r.data);

/**
 * bulk-csv-recipients (CSV-FE-7, D11) — vista `excluded` del MISMO endpoint:
 * lista PAGINADA de personas excluidas (nombre + teléfono + motivo + fuente),
 * para que el operador corrija su CSV mirando QUIÉN quedó afuera y por qué.
 * `view: 'excluded'` se fuerza acá (el caller no lo pasa) para que el tipo de
 * retorno (`ExcludedRecipientsOutput`, shape de `data` distinto) sea correcto
 * en compile-time — separado de `listSegmentRecipients` en vez de un union
 * de output por la misma razón que el BE separa el shape por `view`.
 */
export const listExcludedRecipients = (
  query: Omit<SegmentRecipientsQuery, 'view'>,
): Promise<ExcludedRecipientsOutput> =>
  axiosClient
    .post<ExcludedRecipientsOutput>(`${BASE}/segment/recipients`, { ...query, view: 'excluded' })
    .then((r) => r.data);

export const createCampaign = (input: CreateCampaignInput): Promise<CreateCampaignOutput> =>
  axiosClient.post<CreateCampaignOutput>(`${BASE}/campaigns`, input).then((r) => r.data);

export const sendCampaign = (id: string): Promise<SendCampaignOutput> =>
  axiosClient.post<SendCampaignOutput>(`${BASE}/campaigns/${id}/send`).then((r) => r.data);

/**
 * F2 apply chunk 3 (HIST-3, RecipientsTable) — traduce el `status` del DTO
 * de wire al enum de DOMINIO que el BE castea DIRECTO desde el query param
 * (verificado contra el código real: `domain/entities/campaign.ts`
 * `CampaignRecipientStatus = 'queued'|'sent'|'delivered'|'opted_out'|
 * 'skipped'|'failed'` + `application/dto/messaging-bulk.dto.ts`
 * `toRecipientStatusDto`, que mapea `'opted_out'` (dominio) → `'opted-out'`
 * (wire) SOLO para ese valor). El ÚNICO valor que difiere entre ambos lados
 * es `'opted-out'` (guion, wire) vs `'opted_out'` (guion bajo, dominio) —
 * queued/sent/delivered/skipped/failed son la MISMA string en ambos, no
 * hace falta traducirlos. El caller (RecipientsTable) filtra con el valor
 * que MUESTRA en la tabla (DTO); esta función hace la traducción para que
 * el query param le llegue al BE en el formato que realmente espera.
 */
function toDomainRecipientStatus(status: string): string {
  return status === 'opted-out' ? 'opted_out' : status;
}

export const getCampaign = (id: string, query: GetCampaignQuery = {}): Promise<GetCampaignOutput> => {
  const params: Record<string, string | number> = {};
  if (query.includeRecipients) params['includeRecipients'] = 'true';
  if (query.page) params['page'] = query.page;
  if (query.limit) params['limit'] = query.limit;
  if (query.status) params['status'] = toDomainRecipientStatus(query.status);

  return axiosClient.get<GetCampaignOutput>(`${BASE}/campaigns/${id}`, { params }).then((r) => r.data);
};

export const listCampaigns = (query: PaginatedQuery = {}): Promise<PaginatedResult<CampaignSummaryDto>> => {
  const params: Record<string, number> = {};
  if (query.page) params['page'] = query.page;
  if (query.limit) params['limit'] = query.limit;

  return axiosClient.get<PaginatedResult<CampaignSummaryDto>>(`${BASE}/campaigns`, { params }).then((r) => r.data);
};
