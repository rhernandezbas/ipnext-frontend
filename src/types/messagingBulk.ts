/**
 * messagingBulk (F2, apply chunk 1) — espejo del BE, verificar contra el
 * codigo real (`ipnext-backend/src/application/dto/messaging-bulk.dto.ts` +
 * `domain/entities/campaign.ts` + `domain/ports/TemplateMessagingPort.ts`),
 * NO el boceto de design.md del BE.
 *
 * Nombres de campo alineados con el SPEC del BE (no con design.md donde
 * difieren) — `count`/`skipped.*` (no `total`/`excluded*`), `variablesMap`
 * (no `variableSpec`) en la superficie de entrada de `CreateCampaign`.
 */

// ─── Templates (TPL-1/TPL-2) ─────────────────────────────────────────────────

export type TemplateApprovalStatus = 'approved' | 'pending' | 'rejected' | 'unsubmitted';

export interface TemplateSummaryDto {
  contentSid: string;
  friendlyName: string;
  language: string;
  /** Nombres de variable declarados por el template. */
  variables: string[];
  approvalStatus: TemplateApprovalStatus;
  category?: string;
  /** `true` solo si `approvalStatus === 'approved'` (TPL-1) — gatea seleccionable en el composer. */
  sendable: boolean;
  /**
   * v1.1 (BE en PROD) — texto del template con placeholders `{{N}}`, ej.
   * "Hola {{1}}, saldo de ${{2}}...". Usado por `VariablesMapForm` para
   * mostrar CADA variable en su contexto real (anti-error humano al mapear).
   */
  body: string;
}

// ─── Segmentación (SEG-1..SEG-5) ─────────────────────────────────────────────

export interface CampaignSegment {
  statuses: string[];
  balanceMin?: number;
  balanceMax?: number;
}

/** Input del preview — mismo shape que `CampaignSegment` (SEG-1). */
export type PreviewSegmentInput = CampaignSegment;

export interface PreviewSegmentSampleItemDto {
  clientId: string;
  name: string;
  phoneE164: string;
  /** v1.1 (BE en PROD) — status del cliente (mismo dominio que `CampaignSegment.statuses`, ej. 'late'|'blocked'|'active'). */
  status: string;
}

export interface PreviewSegmentOutput {
  /** Nombre del spec (SEG-1..SEG-4) — NO `total` (nombre de design). */
  count: number;
  /** Muestra acotada (20), determinística. */
  sample: PreviewSegmentSampleItemDto[];
  skipped: {
    /** SEG-2 — excluidos por opt-out. */
    optedOut: number;
    /** SEG-3 — colapsados por de-dup de teléfono. */
    duplicatePhone: number;
    /** SEG-4 — teléfono ausente/inválido. */
    invalidPhone: number;
  };
  /** v1.1 (BE en PROD) — cuenta de clientes MATCHEADOS por status, sobre TODO el segmento (no solo el `sample` de 20). */
  statusCounts: Record<string, number>;
}

// ─── Recipients paginados del segmento (v1.1, BE en PROD) ────────────────────

/** Input de `/segment/recipients` — mismo shape que `CampaignSegment` + paginación. */
export interface SegmentRecipientsQuery extends CampaignSegment {
  page?: number;
  limit?: number;
}

export interface SegmentRecipientDto {
  clientId: string;
  name: string;
  phoneE164: string;
  status: string;
}

export interface SegmentRecipientsOutput {
  data: SegmentRecipientDto[];
  total: number;
  page: number;
  limit: number;
  skipped: PreviewSegmentOutput['skipped'];
  statusCounts: Record<string, number>;
}

// ─── Variables por-destinatario (CAMP-1/CAMP-3, design §3.3) ────────────────

/** v1 whitelist de fuentes para resolver una variable del template. */
export type CampaignVariableSource = 'name' | 'balanceDue' | 'literal';

export interface CampaignVariableSpecEntry {
  source: CampaignVariableSource;
  /** Requerido cuando `source === 'literal'`; ignorado para 'name'/'balanceDue'. */
  value?: string;
}

/** Mapea cada variable del template (key) a cómo se resuelve POR-DESTINATARIO. */
export type CampaignVariableSpec = Record<string, CampaignVariableSpecEntry>;

// ─── Creación de campaña (CAMP-1..CAMP-4) ────────────────────────────────────

export interface CreateCampaignInput {
  name: string;
  /** ContentSid Twilio (HX…). */
  templateRef: string;
  templateName?: string;
  segment: CampaignSegment;
  variablesMap: CampaignVariableSpec;
  // NOTA: `createdById` NO viaja en el body — el BE lo deriva SIEMPRE del
  // usuario autenticado (`req.user.id`, ver `messagingBulk.routes.ts`), nunca
  // del cliente. Incluirlo acá sería un campo fantasma que el BE ignora.
}

export interface CreateCampaignOutput {
  campaignId: string;
  total: number;
  status: 'pending';
}

/**
 * Body del 422 cuando `variablesMap` no cubre todas las `template.variables`
 * (CAMP-4, F2 apply chunk 2 — composer). `missing` son los NOMBRES de
 * variable sin mapear, no índices — el composer los usa para resaltar esas
 * filas exactas en `VariablesMapForm`.
 */
export interface CreateCampaignMissingVariablesBody {
  error: string;
  code: 'MISSING_TEMPLATE_VARIABLES';
  missing: string[];
}

// ─── Envío (SEND-1) ───────────────────────────────────────────────────────────

export interface SendCampaignOutput {
  campaignId: string;
  accepted: true;
}

/** Body del error 409 cuando ya hay OTRA campaña en curso (lock GLOBAL, FIX-15). */
export interface CampaignSendConflictBody {
  error: string;
  code: 'CAMPAIGN_SEND_IN_PROGRESS';
}

// ─── Historial (HIST-1/HIST-2/HIST-3) ────────────────────────────────────────

export type CampaignStatusDto = 'pending' | 'running' | 'paused' | 'done' | 'failed';

/** `opted_out` (dominio, snake_case) → `'opted-out'` en el wire (design §1.2). */
export type CampaignRecipientStatusDto = 'queued' | 'sent' | 'delivered' | 'opted-out' | 'skipped' | 'failed';

export interface CampaignSummaryDto {
  id: string;
  name: string;
  templateName: string | null;
  status: CampaignStatusDto;
  total: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  optedOutCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Detalle (GetCampaign) — header completo + el filtro serializado (auditoría). */
export interface CampaignDto extends CampaignSummaryDto {
  templateRef: string;
  segment: CampaignSegment;
}

export interface CampaignRecipientDto {
  id: string;
  clientId: string;
  phoneE164: string;
  status: CampaignRecipientStatusDto;
  /** HIST-3 — SANEADO, nunca el payload/response crudo del proveedor ni credenciales. */
  error: string | null;
  sentAt: string | null;
}

// ─── Pagination (espejo de application/dto/pagination.ts) ───────────────────

export interface PaginatedQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── GetCampaign (HIST-2/HIST-3) ─────────────────────────────────────────────

export interface GetCampaignQuery {
  /** Si es falsy, `recipients` no viene en el output (evita el costo de paginar). */
  includeRecipients?: boolean;
  page?: number;
  limit?: number;
  /**
   * OJO (verificado contra `messagingBulk.routes.ts` real): el route handler
   * castea este query param DIRECTO al enum de DOMINIO (snake_case,
   * `'opted_out'`), NO al valor con guion del DTO de wire
   * (`CampaignRecipientDto.status`, `'opted-out'`) — no hay traducción. Para
   * filtrar opted-out hay que mandar `'opted_out'` acá, no `'opted-out'`. Se
   * deja `string` (sin el union estricto) para no fingir una garantía de
   * tipos que el BE no cumple; se re-verifica en el chunk que construya el
   * filtro real (RecipientsTable, chunk 2/3).
   */
  status?: string;
}

export interface GetCampaignOutput {
  campaign: CampaignDto;
  recipients?: PaginatedResult<CampaignRecipientDto>;
}
