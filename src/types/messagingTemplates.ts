/**
 * messagingTemplates (Change 3 — CRUD de templates WhatsApp). Espejo del
 * router DEDICADO `/api/messaging/templates` del BE (NO el subset del composer
 * `/messaging/bulk/templates`). Verificar contra el contrato del change
 * (`openspec/changes/messaging-templates-crud/tasks.md`).
 *
 * El shape del template (`TemplateDetailDto`) es IDÉNTICO en el wire al
 * `TemplateSummaryDto` que ya expone el router bulk — reusamos ese tipo como
 * única fuente de verdad en vez de duplicarlo (mismo criterio DRY que el resto
 * del dominio messaging).
 */
import type { TemplateSummaryDto } from '@/types/messagingBulk';

export type { TemplateApprovalStatus } from '@/types/messagingBulk';

/** Categorías de template que Meta/Twilio acepta al crear (contrato BE). */
export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

/**
 * Detalle de un template — mismo shape que la lista. Alias de
 * `TemplateSummaryDto` (contentSid, friendlyName, language, variables[],
 * approvalStatus, category?, sendable, body) para no duplicar el contrato.
 */
export type TemplateDetailDto = TemplateSummaryDto;

/** Body del POST `/templates` (crear/clonar). `variables` son las keys `{{N}}` del body. */
export interface CreateTemplateInput {
  friendlyName: string;
  language: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
}

/** Body del POST `/templates/:sid/submit` (enviar a aprobación de Meta). */
export interface SubmitTemplateInput {
  name: string;
  category: TemplateCategory;
}

/** Respuesta pelada del POST `/templates/:sid/submit`. */
export interface SubmitTemplateOutput {
  contentSid: string;
  submitted: boolean;
}

/**
 * Body del 409 `TEMPLATE_IN_USE` al borrar un template usado por campañas
 * activas. `campaignIds` son las campañas que BLOQUEAN el borrado — se le
 * muestran al operador (NO se trata como éxito).
 */
export interface TemplateInUseBody {
  error?: string;
  code: 'TEMPLATE_IN_USE';
  campaignIds: string[];
}
