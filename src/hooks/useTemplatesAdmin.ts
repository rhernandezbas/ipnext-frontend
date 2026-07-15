import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/messagingTemplates.api';
import { bulkTemplatesKey } from '@/hooks/useBulkMessaging';
import type {
  CreateTemplateInput,
  SubmitTemplateInput,
  TemplateInUseBody,
} from '@/types/messagingTemplates';

/**
 * useTemplatesAdmin (Change 3) — hooks del ABM de templates WhatsApp en un
 * solo archivo (convención del repo, molde `useBulkMessaging.ts`).
 *
 * La LISTA usa la key propia `['messagingTemplates']` (endpoint dedicado
 * `/messaging/templates`), separada de la del composer
 * (`['messagingBulk','templates']`, subset `/messaging/bulk/templates`). Las
 * mutations invalidan AMBAS: crear/enviar/borrar un template cambia lo que ve
 * TANTO esta página COMO el dropdown del composer — mantenerlas en sync es
 * correctness, no acoplamiento gratuito.
 */

export const templatesAdminKey = ['messagingTemplates'] as const;

/** ABM read — catálogo completo de templates. `enabled` lo ata el caller al permiso `messaging.templates`. */
export function useTemplatesList(enabled: boolean = true) {
  return useQuery({
    queryKey: templatesAdminKey,
    queryFn: api.listTemplates,
    enabled,
    staleTime: 60_000,
  });
}

/** Invalida la lista del ABM + el catálogo del composer (ver nota del módulo). */
function invalidateTemplateCaches(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: templatesAdminKey });
  void qc.invalidateQueries({ queryKey: bulkTemplatesKey });
}

/**
 * Mensaje claro para los errores del proveedor/validación al crear o enviar un
 * template. Mapea por STATUS (más robusto que por code, que puede variar), con
 * el `error` del body como override si el BE lo manda.
 */
function toServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: string } | undefined;
    if (status === 400) return body?.error ?? 'Datos inválidos: revisá que el cuerpo no esté vacío y la categoría sea válida.';
    if (status === 422) return body?.error ?? 'WhatsApp rechazó el template. Revisá el contenido y reintentá.';
    if (status === 503) return body?.error ?? 'El proveedor de WhatsApp no está disponible. Reintentá en unos segundos.';
    if (status === 404) return body?.error ?? 'El template ya no existe (quizás se borró desde otra sesión).';
  }
  return 'No se pudo completar la acción. Reintentá en unos segundos.';
}

/**
 * CREATE (crear/clonar) — invalida la lista al crear. Los errores del proveedor
 * (400/422/503) se exponen como `serverError` (string) para mostrarlos en el
 * form (role=alert), en vez de un Error crudo.
 */
export function useCreateTemplate() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => api.createTemplate(input),
    onSuccess: () => invalidateTemplateCaches(qc),
  });

  return {
    create: mutation.mutate,
    createAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

/** SUBMIT-for-approval — POST /:sid/submit con {name, category}. Invalida la lista. */
export function useSubmitTemplate() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ sid, input }: { sid: string; input: SubmitTemplateInput }) => api.submitTemplate(sid, input),
    onSuccess: () => invalidateTemplateCaches(qc),
  });

  return {
    submit: mutation.mutate,
    submitAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

/** DTO del 409 TEMPLATE_IN_USE expuesto por el hook (`message`, no `error`, para no confundirlo con un Error). */
export interface TemplateInUseError {
  code: TemplateInUseBody['code'];
  message: string;
  campaignIds: string[];
}

/** Detecta el 409 TEMPLATE_IN_USE — mismo criterio que `toSendConflict` de useBulkMessaging. */
function toInUseError(error: unknown): TemplateInUseError | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const body = error.response.data as Partial<TemplateInUseBody> | undefined;
  if (body?.code !== 'TEMPLATE_IN_USE') return null;
  return {
    code: 'TEMPLATE_IN_USE',
    message: body.error ?? 'No se puede borrar: el template está en uso por campañas activas.',
    campaignIds: body.campaignIds ?? [],
  };
}

/** El `serverError` del delete EXCLUYE el 409 TEMPLATE_IN_USE (lo maneja `inUseError`). */
function toDeleteServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const body = error.response.data as { code?: string } | undefined;
    if (body?.code === 'TEMPLATE_IN_USE') return null; // lo maneja `inUseError`
  }
  return toServerError(error) ?? 'No se pudo borrar el template. Reintentá.';
}

/**
 * DELETE — borra el template (TAMBIÉN de Meta, irreversible). Invalida la lista
 * al resolver. El 409 TEMPLATE_IN_USE (usado por campañas activas) se expone
 * como `inUseError` con los `campaignIds` que bloquean — NUNCA se trata como
 * éxito.
 */
export function useDeleteTemplate() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (sid: string) => api.deleteTemplate(sid),
    onSuccess: () => invalidateTemplateCaches(qc),
  });

  return {
    remove: mutation.mutate,
    removeAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    inUseError: toInUseError(mutation.error),
    serverError: toDeleteServerError(mutation.error),
  };
}
