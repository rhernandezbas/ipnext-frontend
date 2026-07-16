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
  /**
   * node-segment-fe — filtro por nodo (`NetworkSite.id`). Semántica BE (contrato
   * FIJO): AND con estados/deuda; un nodo SOLO ya es un segmento válido (el BE
   * ya no exige estados/deuda si hay nodo/AP). `undefined` = sin filtro (la key
   * se OMITE del payload, mismo criterio que `balanceMin` vacío); `null` también
   * aceptado por el BE como "sin filtro" explícito.
   */
  networkSiteId?: string | null;
  /**
   * node-segment-fe — filtro por Access Point (`AccessPointOption.id`). Puede ir
   * CON o SIN nodo (un AP solo también es un segmento válido). Mismas reglas de
   * `undefined`/`null` que `networkSiteId`.
   */
  accessPointId?: string | null;
}

/**
 * bulk-csv-recipients FE (TYPE-CSV-1) — un contacto CRUDO del CSV, PARALELO a
 * `manualClientIds` (paralelo, NO anidado). Espejo de `CsvContact`
 * (`parseRecipientsCsv.ts`) — el BE lo vincula por teléfono (match exacto,
 * design D3) o lo persiste como fila "contact" (`clientId: null`).
 */
export interface ManualContactInput {
  name: string;
  phone: string;
}

/**
 * Input del preview — el segmento (SEG-1) MÁS, opcionalmente, la lista manual
 * de clientes (manual-recipients-fe, TYPE-1) Y los contactos crudos del CSV
 * (bulk-csv-recipients, TYPE-CSV-1). Ambas listas viajan FLAT (junto a
 * `statuses`) porque `previewSegment`/`listSegmentRecipients` postean el
 * input directo; el BE devuelve `count` = unión dedup de las 3 fuentes.
 * UUIDs como `string[]`.
 */
export type PreviewSegmentInput = CampaignSegment & {
  manualClientIds?: string[];
  manualContacts?: ManualContactInput[];
};

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

/**
 * Input de `/segment/recipients` — mismo shape que `PreviewSegmentInput`
 * (segmento + `manualClientIds`? + `manualContacts`?, bulk-csv-recipients D11)
 * MÁS paginación y la vista (`view`, default `'recipients'` server-side).
 */
export interface SegmentRecipientsQuery extends CampaignSegment {
  manualClientIds?: string[];
  manualContacts?: ManualContactInput[];
  page?: number;
  limit?: number;
  /** `'recipients'` (default, tabla de destinatarios) | `'excluded'` (bulk-csv-recipients CSV-FE-7). */
  view?: 'recipients' | 'excluded';
}

export interface SegmentRecipientDto {
  /**
   * bulk-csv-recipients (D11) — `null` para un contacto CSV que NO matcheó
   * ningún cliente (crudo). El FE keyea filas con `clientId ?? phoneE164`
   * (CSV-FE-6).
   */
  clientId: string | null;
  name: string;
  phoneE164: string;
  /** `'no_cliente'` (sintético) para un contacto CSV crudo — ver `statusLabel` en `PreviewModal`. */
  status: string;
  /** bulk-csv-recipients (D11) — de qué fuente vino ('segment'|'manual'|'csv'). Opcional: no todos los BE lo mandan todavía. */
  source?: 'segment' | 'manual' | 'csv';
}

export interface SegmentRecipientsOutput {
  data: SegmentRecipientDto[];
  total: number;
  page: number;
  limit: number;
  skipped: PreviewSegmentOutput['skipped'];
  statusCounts: Record<string, number>;
}

// ─── Excluidos por persona (bulk-csv-recipients, CSV-FE-7, D7/D11) ───────────

/** Motivo de exclusión POR PERSONA (BE, defensa en profundidad — el FE ya filtra `sin_nombre`/`sin_telefono` del CSV localmente). */
export type ExcludedRecipientReason = 'sin_nombre' | 'sin_telefono' | 'telefono_invalido' | 'opt_out' | 'duplicado';

export interface ExcludedRecipientDto {
  name: string;
  phone: string;
  reason: ExcludedRecipientReason;
  source?: 'segment' | 'manual' | 'csv';
  /** Presente sólo si el excluido llegó a vincularse a un cliente (ej. `duplicado` de un manual ya en el segmento). */
  clientId?: string | null;
  status?: string;
}

/** `view: 'excluded'` de `/segment/recipients` — mismo sobre (`total/page/limit/skipped/statusCounts`) que la vista de destinatarios, `data` cambia de shape. */
export interface ExcludedRecipientsOutput {
  data: ExcludedRecipientDto[];
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
  /**
   * manual-recipients-fe (TYPE-1) — lista manual de clientes, PARALELA a
   * `segment` (top-level, NO anidada). El BE une (dedup) esta lista con el
   * segmento. Opcional: se OMITE cuando está vacía (cero cambio en el payload
   * de los flujos que sólo usan segmento). UUIDs como `string[]`.
   */
  manualClientIds?: string[];
  /**
   * bulk-csv-recipients (TYPE-CSV-1) — contactos crudos del CSV, PARALELO a
   * `manualClientIds` (top-level, NO anidado). El BE los vincula por teléfono
   * o los persiste como fila "contact" (`clientId: null`). Opcional: se OMITE
   * cuando está vacío (cero cambio en los payloads que no usan CSV).
   */
  manualContacts?: ManualContactInput[];
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

/**
 * Body del 422 cuando algún `manualClientIds` ya no existe en el sistema
 * (manual-recipients-fe, ERR-1). `missingClientIds` son los ids que el BE no
 * encontró — el composer los usa para marcar esos chips como inválidos.
 */
export interface CreateCampaignManualRecipientsNotFoundBody {
  error: string;
  code: 'MANUAL_RECIPIENTS_NOT_FOUND';
  missingClientIds: string[];
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
