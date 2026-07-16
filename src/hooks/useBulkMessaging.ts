import axios from 'axios';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/messagingBulk.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type {
  CampaignSendConflictBody,
  CampaignStatusDto,
  CreateCampaignInput,
  CreateCampaignManualRecipientsNotFoundBody,
  CreateCampaignMissingVariablesBody,
  GetCampaignOutput,
  GetCampaignQuery,
  PaginatedQuery,
  PreviewSegmentInput,
  SegmentRecipientsQuery,
} from '@/types/messagingBulk';

/**
 * useBulkMessaging (F2, apply chunk 1) — hooks del Envío masivo WhatsApp en un
 * solo archivo (convención del repo, molde `useWhatsapp.ts`).
 *
 * Query keys como funciones puras exportadas (mismo criterio que
 * `useWhatsapp.ts`). Las mutations derivan las keys de cache/invalidación de
 * las VARS del `mutate` (`campaignId` pasado explícitamente), nunca de un
 * closure — acá no aplica el bug de `useSendWhatsappMessage` (no hay un `id`
 * de hook fijo que un componente pueda mutar bajo la mismísima instancia),
 * pero se mantiene el mismo hábito defensivo por consistencia y porque
 * `useSendCampaign`/`useCreateCampaign` no toman ningún id por argumento del
 * hook — CADA key sale de lo que el caller pasó a `send`/`create`.
 */

export const bulkTemplatesKey = ['messagingBulk', 'templates'] as const;

export const bulkCampaignsKey = (query: PaginatedQuery) => ['messagingBulk', 'campaigns', query] as const;

export const bulkCampaignKey = (id: string, query: GetCampaignQuery = {}) =>
  ['messagingBulk', 'campaign', id, query] as const;

export const bulkSegmentRecipientsKey = (query: SegmentRecipientsQuery) =>
  ['messagingBulk', 'segmentRecipients', query] as const;

/** bulk-csv-recipients (CSV-FE-7) — key separada de la de `recipients` (mismo query, otro `view`, otro shape de output). */
export const bulkExcludedRecipientsKey = (query: Omit<SegmentRecipientsQuery, 'view'>) =>
  ['messagingBulk', 'excludedRecipients', query] as const;

/** TPL-1/TPL-2 — catálogo de templates. `enabled` lo ata el caller al permiso `messaging.templates`. */
export function useTemplates(enabled: boolean = true) {
  return useQuery({
    queryKey: bulkTemplatesKey,
    queryFn: api.listBulkTemplates,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * SEG-1..SEG-5 — preview del segmento, ON-DEMAND (mutation, no query): el
 * composer dispara `preview(segment)` explícitamente en cada "Ver preview",
 * NUNCA en cada tecla — evita pegarle al BE (y a la fuente de segmentación)
 * en cada cambio de filtro.
 */
export function usePreviewSegment() {
  const mutation = useMutation({
    mutationFn: (input: PreviewSegmentInput) => api.previewSegment(input),
  });

  return {
    preview: mutation.mutate,
    previewAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/** DTO de error expuesto por el hook cuando `variablesMap` no cubre todas las `template.variables` (CAMP-4). */
export interface CreateCampaignMissingVariablesError {
  code: CreateCampaignMissingVariablesBody['code'];
  message: string;
  missing: string[];
}

/** Detecta el 422 MISSING_TEMPLATE_VARIABLES — mismo criterio que `toSendConflict` de abajo. */
function toMissingVariablesError(error: unknown): CreateCampaignMissingVariablesError | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return null;
  const body = error.response.data as Partial<CreateCampaignMissingVariablesBody> | undefined;
  if (body?.code !== 'MISSING_TEMPLATE_VARIABLES') return null;
  return {
    code: 'MISSING_TEMPLATE_VARIABLES',
    message: body.error ?? 'Faltan variables del template por mapear',
    missing: body.missing ?? [],
  };
}

/** DTO de error expuesto por el hook cuando algún `manualClientIds` ya no existe (ERR-1). */
export interface ManualRecipientsNotFoundError {
  code: CreateCampaignManualRecipientsNotFoundBody['code'];
  message: string;
  /** Ids que el BE no encontró — el composer marca esos chips como inválidos. */
  missingClientIds: string[];
}

/** Detecta el 422 MANUAL_RECIPIENTS_NOT_FOUND — mismo criterio que `toMissingVariablesError`. */
function toManualRecipientsNotFoundError(error: unknown): ManualRecipientsNotFoundError | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return null;
  const body = error.response.data as Partial<CreateCampaignManualRecipientsNotFoundBody> | undefined;
  if (body?.code !== 'MANUAL_RECIPIENTS_NOT_FOUND') return null;
  return {
    code: 'MANUAL_RECIPIENTS_NOT_FOUND',
    message: body.error ?? 'Algunos destinatarios manuales ya no existen',
    missingClientIds: body.missingClientIds ?? [],
  };
}

/** Mensajes claros para los códigos de error del BE al crear (contrato CAMPAIGN spec). */
const CREATE_ERROR_MESSAGES: Record<string, string> = {
  EMPTY_SEGMENT: 'El segmento no tiene destinatarios. Ajustá los filtros y volvé a intentar.',
  UNFILTERED_SEGMENT: 'El segmento no tiene ningún filtro efectivo (elegí un estado o una deuda mayor a $0).',
  TEMPLATE_NOT_APPROVED: 'El template seleccionado no está aprobado para envío. Elegí otro.',
  // manual-recipients-fe (ERR-1) — errores de la lista manual.
  TOO_MANY_MANUAL_RECIPIENTS: 'Máximo 5000 destinatarios manuales. Reducí la lista y volvé a intentar.',
  VALIDATION_ERROR: 'Hay datos inválidos en la campaña. Revisá los destinatarios y volvé a intentar.',
};

/**
 * FIX-3b — mensaje para errores de creación que NO son el 422 MISSING_TEMPLATE_VARIABLES
 * (ese se resuelve aparte, resaltando filas en `VariablesMapForm`). Antes estos
 * errores (EMPTY_SEGMENT / UNFILTERED_SEGMENT / TEMPLATE_NOT_APPROVED / red / 500)
 * caían en un catch vacío → "el botón no hace nada".
 */
function toCreateServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { code?: string } | undefined;
    // Ambos 422 con dato estructurado se manejan aparte (resaltan filas/chips),
    // no como un texto genérico: MISSING_TEMPLATE_VARIABLES (`missingVariablesError`)
    // y MANUAL_RECIPIENTS_NOT_FOUND (`missingRecipientsError`, ERR-1).
    if (
      error.response?.status === 422 &&
      (body?.code === 'MISSING_TEMPLATE_VARIABLES' || body?.code === 'MANUAL_RECIPIENTS_NOT_FOUND')
    ) {
      return null;
    }
    if (body?.code && CREATE_ERROR_MESSAGES[body.code]) return CREATE_ERROR_MESSAGES[body.code];
  }
  return 'No se pudo crear la campaña. Reintentá en unos segundos.';
}

/**
 * CAMP-1..CAMP-4 — crea la campaña en `pending` (sin disparar el envío, ver
 * `useSendCampaign`). Invalida el listado de campañas al crear para que
 * Historial la muestre sin esperar el próximo refetch manual.
 *
 * 422 MISSING_TEMPLATE_VARIABLES (CAMP-4): se expone como `missingVariablesError`
 * (en vez de un `error` genérico) para que el composer (`VariablesMapForm`)
 * pueda resaltar EXACTAMENTE las variables que el servidor rechazó — mismo
 * criterio que `conflict` en `useSendCampaign`.
 */
export function useCreateCampaign() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateCampaignInput) => api.createCampaign(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['messagingBulk', 'campaigns'] });
    },
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
    missingVariablesError: toMissingVariablesError(mutation.error),
    missingRecipientsError: toManualRecipientsNotFoundError(mutation.error),
    serverError: toCreateServerError(mutation.error),
  };
}

/** DTO de conflicto expuesto por el hook — `message` (no `error`) para no confundirlo con un Error genérico. */
export interface SendCampaignConflict {
  code: CampaignSendConflictBody['code'];
  message: string;
}

/** Detecta el 409 CAMPAIGN_SEND_IN_PROGRESS (lock GLOBAL — FIX-15, puede ser OTRA campaña en curso). */
function toSendConflict(error: unknown): SendCampaignConflict | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const body = error.response.data as Partial<CampaignSendConflictBody> | undefined;
  if (body?.code !== 'CAMPAIGN_SEND_IN_PROGRESS') return null;
  return { code: 'CAMPAIGN_SEND_IN_PROGRESS', message: body.error ?? 'Ya hay un envío de campañas en curso' };
}

/**
 * SEND-1 — dispara el envío de una campaña YA creada. `send(campaignId)`
 * recibe el id como var del mutate (no hay id de hook fijo) — la invalidación
 * de detalle + lista se deriva de ESA var, nunca de un closure.
 *
 * 409 CAMPAIGN_SEND_IN_PROGRESS (lock GLOBAL — una campaña a la vez): se
 * expone como `conflict` (en vez de un `error` genérico) para que la UI
 * pueda mostrar el mensaje específico ("reintentá cuando termine") distinto
 * de un error de red/servidor.
 */
export function useSendCampaign() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (campaignId: string) => api.sendCampaign(campaignId),
    onSuccess: (_data, campaignId) => {
      void qc.invalidateQueries({ queryKey: ['messagingBulk', 'campaign', campaignId] });
      void qc.invalidateQueries({ queryKey: ['messagingBulk', 'campaigns'] });
    },
  });

  return {
    send: mutation.mutate,
    sendAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    conflict: toSendConflict(mutation.error),
  };
}

/**
 * bulk-detail-polling-fe (Change A) — política de polling del detalle,
 * extraída a función PURA para poder testearla sin montar el hook. Antes
 * `pending`/`paused` devolvían `false` (página muerta: el usuario tenía que
 * F5 a mano para ver que el envío arrancó o se reanudó). Ahora:
 *  - pestaña oculta            → false (nunca pollear en background)
 *  - `running`                 → 5_000 (progreso en vivo del envío)
 *  - `pending` | `paused`      → 30_000 (se refresca solo, sin F5)
 *  - `done` | `failed` | undefined → false (terminal / sin data todavía)
 *
 * MEDIUM-3 (Fix Wave, review adversarial) — 3er parámetro `{ heavy }`: la
 * variante PESADA de la query (`includeRecipients:true`, la usa
 * `RecipientsTable`) trae el payload completo de destinatarios. Los
 * recipients de una campaña `pending`/`paused` son INMUTABLES (el envío
 * todavía no arrancó / está pausado) — pollear ese payload pesado cada 30s
 * es desperdicio. La key LIVIANA (`CampaignHeader`, sin `includeRecipients`)
 * ya detecta la transición a `running` con SU propio poll de 30s; recién ahí
 * la variante pesada arranca su poll de 5s. `heavy` default `false` (misma
 * política de siempre para la variante liviana).
 *
 * MEDIUM (re-review Fix Wave) — la promesa de arriba ("la liviana detecta la
 * transición y recién ahí la pesada arranca") NO estaba cableada: como la
 * heavy jamás refetchea en pending/paused, `q.state.data?.campaign.status`
 * (adentro de `refetchInterval`) leía SIEMPRE el status VIEJO de SU PROPIO
 * cache — nunca el de la key liviana. Si el envío lo disparaba OTRO
 * operador/sesión (no esta misma pestaña), la heavy quedaba clavada en
 * pending para siempre, aunque la liviana ya viera `running`. Fix: dentro de
 * `useCampaign` (abajo) se lee TAMBIÉN `queryClient.getQueryData` de la key
 * liviana (`bulkCampaignKey(id)`) y se prefiere ese status si existe — así
 * el recompute del interval (que React Query dispara en cada render vía
 * `setOptions`) usa el dato más fresco disponible, sea cual sea el cache que
 * lo trajo.
 */
export function campaignPollInterval(
  status: CampaignStatusDto | undefined,
  visible: boolean,
  opts: { heavy?: boolean } = {},
): number | false {
  if (!visible) return false;
  if (status === 'running') return 5_000;
  if (opts.heavy) return false;
  if (status === 'pending' || status === 'paused') return 30_000;
  return false;
}

/**
 * HIST-2/HIST-3 — detalle de una campaña. Polling gobernado por
 * `campaignPollInterval` (arriba) + `useDocumentVisible` (mismo gate que
 * `useWhatsapp.ts`).
 *
 * `active` (3er parámetro, default `true`, MEDIUM-2 Fix Wave) — gatea el
 * poll independientemente de la visibilidad del DOCUMENTO: con
 * `Tabs mountMode="all"` (`BulkMessagingPage`), `CampaignDetail` (y sus
 * hijos `CampaignHeader`/`RecipientsTable`) siguen MONTADOS detrás del tab
 * "Nueva campaña" — la pestaña del BROWSER puede estar visible mientras el
 * TAB de la page no lo está. `visible && active` combina ambos gates sin
 * ensuciar `campaignPollInterval` (que solo conoce `visible`).
 *
 * `heavy` se deriva de `query.includeRecipients` — no hace falta que el
 * caller lo pase aparte, ya viene en la misma query que arma el payload.
 *
 * MEDIUM (re-review Fix Wave) — para la variante heavy, el status que decide
 * el próximo intervalo NO sale solo de `q.state.data` (SU PROPIO cache,
 * potencialmente viejo si nunca refetcheó) sino, con preferencia, del cache
 * de la key LIVIANA (`bulkCampaignKey(id)`, sin `includeRecipients` —
 * misma key que usan `CampaignHeader`/`CampaignDetail`). Esa key pollea
 * siempre que haya `running`/`pending`/`paused` (nunca queda "muda" como la
 * heavy), así que es la fuente más fresca disponible en el `QueryClient`
 * compartido — sin importar qué pestaña/hook la haya escrito.
 */
export function useCampaign(id: string, query: GetCampaignQuery = {}, active: boolean = true) {
  const visible = useDocumentVisible();
  const heavy = !!query.includeRecipients;
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: bulkCampaignKey(id, query),
    queryFn: () => api.getCampaign(id, query),
    enabled: !!id,
    refetchInterval: (q) => {
      const ownStatus = q.state.data?.campaign.status;
      const status = heavy
        ? (queryClient.getQueryData<GetCampaignOutput>(bulkCampaignKey(id))?.campaign.status ?? ownStatus)
        : ownStatus;
      return campaignPollInterval(status, visible && active, { heavy });
    },
  });
}

/**
 * HIST-1 — historial paginado de campañas.
 *
 * `enabled` (messaging-bulk-inbox Change 2) — el caller lo ata a un permiso
 * (mismo patrón que `useTemplates(enabled)`): el filtro de campaña del inbox
 * gatea este fetch a `messaging.bulk` (el endpoint `/messaging/bulk/campaigns`
 * lo requiere; sin permiso sería un 403). Default `true` (cero regresión:
 * Historial y cualquier caller previo que llame sin el 2do argumento sigue
 * fetcheando igual que antes).
 *
 * `poll` (3er parámetro, default `false`, HIGH-1 Fix Wave) — el polling de
 * 30s es OPT-IN. Antes `refetchInterval: visible ? 30_000 : false` estaba
 * SIEMPRE activo acá (hook COMPARTIDO): cualquier caller heredaba el poll
 * sin pedirlo — `WhatsappInboxPage` lo usa para poblar el dropdown de filtro
 * de campaña del inbox, y con el inbox abierto eso sumaba ~2880 requests/día
 * nuevos por agente. Ahora SOLO pollea si el caller pasa `poll:true`
 * explícitamente — lo hace `CampaignsTable` (tab "Historial", HIST-1), que
 * además lo combina con si su tab está activo (MEDIUM-2). El inbox queda
 * EXACTAMENTE como estaba (fetch on-mount + invalidación, sin poll).
 */
export function useCampaigns(query: PaginatedQuery, enabled: boolean = true, poll: boolean = false) {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: bulkCampaignsKey(query),
    queryFn: () => api.listCampaigns(query),
    enabled,
    refetchInterval: poll && visible ? 30_000 : false,
  });
}

/**
 * v1.1 (BE en PROD) — recipients PAGINADOS de un segmento (a diferencia de
 * `usePreviewSegment`, que trunca a una muestra de 20 vía mutation). Query
 * (no mutation): pensado para paginar una tabla, no para un "Ver preview"
 * on-demand — `enabled` lo ata el caller a si ya hay un criterio efectivo
 * (mismo gate que `useTemplates(enabled)`).
 *
 * bulk-csv-recipients (CSV-FE-6) — `query` es el input COMPLETO (segmento +
 * `manualClientIds`? + `manualContacts`? + página/límite), UN solo objeto
 * (ya no `segment, page, limit` posicionales) — `PreviewModal` arma la unión
 * completa de las 3 fuentes acá.
 *
 * `keepPreviousData` (v5: `placeholderData`) — al cambiar de página, la
 * tabla sigue mostrando la página anterior (sin flash de loading) mientras
 * resuelve la nueva; `isFetching` distingue ese estado de `isPending`.
 */
export function useSegmentRecipients(query: SegmentRecipientsQuery, enabled: boolean = true) {
  return useQuery({
    queryKey: bulkSegmentRecipientsKey(query),
    queryFn: () => api.listSegmentRecipients(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * bulk-csv-recipients (CSV-FE-7) — vista "Excluidos (N)" del `PreviewModal`:
 * misma query base que `useSegmentRecipients` (sin `view`, se fuerza en el
 * adapter) pero apuntando al shape `ExcludedRecipientsOutput`. Query PROPIA
 * (key distinta) — no comparte cache con la vista de destinatarios aunque el
 * input sea el mismo, porque el `view` cambia el HTTP body real.
 */
export function useExcludedRecipients(query: Omit<SegmentRecipientsQuery, 'view'>, enabled: boolean = true) {
  return useQuery({
    queryKey: bulkExcludedRecipientsKey(query),
    queryFn: () => api.listExcludedRecipients(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}
