import axiosClient from './axios-client';
import type {
  CreateTemplateInput,
  SubmitTemplateInput,
  SubmitTemplateOutput,
  TemplateDetailDto,
} from '@/types/messagingTemplates';

/**
 * messagingTemplates.api (Change 3) — cliente del router DEDICADO
 * `/api/messaging/templates` (CRUD de templates WhatsApp). Distinto del subset
 * del composer (`/messaging/bulk/templates`, ver `messagingBulk.api.ts`): este
 * es el ABM completo (crear / enviar a aprobación / borrar).
 *
 * OJO envelope ASIMETRICO por endpoint (contrato del change):
 * - GET    /templates          → `res.json({data})`            → UNWRAP `.data.data`
 * - GET    /templates/:sid      → `TemplateDetailDto`           → PELADO
 * - POST   /templates          → `TemplateDetailDto`           → PELADO
 * - POST   /templates/:sid/submit → `{contentSid, submitted}`  → PELADO
 * - DELETE /templates/:sid      → 204 No Content                → void
 *
 * Los errores (400 VALIDATION_ERROR, 422 provider, 503 provider no disponible,
 * 404 TEMPLATE_NOT_FOUND, 409 TEMPLATE_IN_USE con `campaignIds`) los rechaza
 * axios como error — los mapea el hook (`useTemplatesAdmin`), no acá.
 */

const BASE = '/messaging/templates';

export const listTemplates = (): Promise<TemplateDetailDto[]> =>
  axiosClient.get<{ data: TemplateDetailDto[] }>(BASE).then((r) => r.data.data);

export const getTemplate = (sid: string): Promise<TemplateDetailDto> =>
  axiosClient.get<TemplateDetailDto>(`${BASE}/${sid}`).then((r) => r.data);

export const createTemplate = (input: CreateTemplateInput): Promise<TemplateDetailDto> =>
  axiosClient.post<TemplateDetailDto>(BASE, input).then((r) => r.data);

export const submitTemplate = (sid: string, input: SubmitTemplateInput): Promise<SubmitTemplateOutput> =>
  axiosClient.post<SubmitTemplateOutput>(`${BASE}/${sid}/submit`, input).then((r) => r.data);

export const deleteTemplate = (sid: string): Promise<void> =>
  axiosClient.delete(`${BASE}/${sid}`).then(() => undefined);
