import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as api from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type {
  DraftAttachment,
  PendingSend,
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappConversationStatus,
  WhatsappInboxClientContext,
  WhatsappMessage,
  WhatsappPaginatedQuery,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

/**
 * useWhatsapp (messaging-inbox F1, design §4/§5) — los 4 hooks del inbox en un
 * solo archivo (convención del repo, molde `useTicketComments.ts` /
 * `useUispSyncStatus.ts`).
 *
 * Polling gateado por `useDocumentVisible()`: `refetchIntervalInBackground` NO
 * alcanza acá (solo controla si el refetch sigue en background, no si el
 * intervalo arranca) — la pausa real es poner `refetchInterval` en `false`
 * cuando la pestaña está oculta.
 */

const WHATSAPP_CONVERSATIONS_ROOT = ['whatsapp', 'conversations'] as const;

export const whatsappConversationsKey = (query: WhatsappPaginatedQuery) =>
  [...WHATSAPP_CONVERSATIONS_ROOT, query] as const;

export const whatsappConversationKey = (id: string) => ['whatsapp', 'conversation', id] as const;

export const whatsappMessagesKey = (id: string) => ['whatsapp', 'messages', id] as const;

/**
 * whatsappPendingSendsKey (messaging-inbox-v2-media F1.5 fase A, Tanda 2,
 * design §6.3) — slice de cache PROPIO para envíos en vuelo, que el poll de
 * `useWhatsappMessages` (5s) NUNCA toca. Sin esto, una subida de varios MB
 * dura más que un ciclo de poll y el reemplazo del array entero borraría la
 * burbuja optimista (parpadeo).
 */
export const whatsappPendingSendsKey = (id: string) => ['whatsapp', 'pendingSends', id] as const;

export const whatsappClientContextKey = (conversationId: string, clientId: string | null) =>
  ['whatsapp', 'clientContext', conversationId, clientId ?? '_'] as const;

/** messaging-inbox-assignment F1.5-C2 — catálogos (agentes asignables / áreas). */
export const whatsappAssignableUsersKey = ['whatsapp', 'assignableUsers'] as const;
export const whatsappAreasKey = ['whatsapp', 'areas'] as const;

/**
 * inbox-views (Ola 1) — contadores por vista del sub-menú (`GET
 * /messaging/conversations/counts`). FUERA de `WHATSAPP_CONVERSATIONS_ROOT`
 * A PROPÓSITO: los optimistas de status/assignee/area hacen `setQueriesData`
 * root-scoped asumiendo el shape paginado (`old.data.map(...)`) — un entry de
 * counts colgado bajo ese root sería "parcheado" por esos updaters (crash u
 * objeto corrupto). El precio es invalidarlo EXPLÍCITAMENTE en las mutations
 * que mueven conversaciones entre vistas (status/assignee, ver `onSettled`).
 */
export const whatsappViewCountsKey = ['whatsapp', 'viewCounts'] as const;

/** inbox-template-send (design D11) — catálogo de templates enviables desde el composer. */
export const whatsappSendTemplatesKey = ['whatsapp', 'sendTemplates'] as const;

/** LIST-1 — lista de conversaciones, polling ~15s, sin flicker al paginar. */
export function useWhatsappConversations(query: WhatsappPaginatedQuery) {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: whatsappConversationsKey(query),
    queryFn: () => api.listWhatsappConversations(query),
    refetchInterval: visible ? 15_000 : false,
    placeholderData: keepPreviousData,
  });
}

/**
 * THREAD-1 (detalle) — fetch-on-open, refresca canReply + clientContext.
 *
 * BUG FIX (post-review-adversarial — bug #6): este query dispara
 * `GetConversation`, que en el BE hace fetch-on-open contra Chatwoot (NO lee
 * un mirror barato como `useWhatsappMessages`) — a 5s de intervalo son
 * ~720 syncs/hora/agente contra Chatwoot para datos que cambian poco
 * (`canReply`/`clientContext`). Bajado a 25s: sigue siendo "casi en vivo"
 * para el agente sin saturar la integración externa.
 */
export function useWhatsappConversation(id: string) {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: whatsappConversationKey(id),
    queryFn: () => api.getWhatsappConversation(id),
    enabled: !!id,
    refetchInterval: visible ? 25_000 : false,
  });
}

/** THREAD-1 (mensajes) — historial del thread abierto, polling ~5s pausado sin foco. */
export function useWhatsappMessages(id: string) {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: whatsappMessagesKey(id),
    queryFn: () => api.listWhatsappMessages(id),
    enabled: !!id,
    refetchInterval: visible ? 5_000 : false,
  });
}

/**
 * useInboxViewCounts (inbox-views Ola 1) — contadores por vista para los
 * badges del sub-menú lateral (`InboxViewsMenu`). Polling 30s (más laxo que
 * la lista de 15s: los badges son orientativos, la lista es la verdad) —
 * mismo gate `useDocumentVisible` que el resto del archivo. Sin `enabled`
 * por permiso: el endpoint pide `messaging:read`, el MISMO gate que el
 * listado que esta página ya requiere para existir — si el GET falla igual
 * (403/503), `data` queda undefined y el sub-menú degrada a "sin números"
 * (nunca roto). Refresh inmediato post-mutación: `useSetConversationStatus`
 * y `useSetConversationAssignee` invalidan `whatsappViewCountsKey` en su
 * `onSettled` (resolver/reabrir/asignar mueven conversaciones entre vistas).
 */
export function useInboxViewCounts() {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: whatsappViewCountsKey,
    queryFn: api.getInboxViewCounts,
    refetchInterval: visible ? 30_000 : false,
  });
}

/**
 * usePendingSends(id) (messaging-inbox-v2-media F1.5 fase A, Tanda 2, design
 * §6.3) — lectura reactiva del slice `whatsappPendingSendsKey`. Patrón
 * "cache-como-store": `enabled:false` → nunca refetchea (no hay `queryFn`),
 * pero el observer de React Query SÍ re-renderiza ante cada `setQueryData`
 * que `useSendWhatsappMessage` haga sobre esta misma key.
 */
export function usePendingSends(id: string): PendingSend[] {
  return (
    useQuery({
      queryKey: whatsappPendingSendsKey(id),
      enabled: false,
      initialData: [] as PendingSend[],
    }).data ?? []
  );
}

/**
 * COMPOSER-1 / SEND (messaging-inbox-v2-media F1.5 fase A, Tanda 2, design
 * §6.3) — envío de texto y/o media con optimistic UI + progreso. Devuelve
 * `{send,retry,discard,isError,error}` (YA NO el `useMutation` crudo — el
 * spinner de "enviando" vive en la burbuja optimista, no en el botón del
 * composer, así que `isPending` deja de ser relevante acá).
 *
 * Problema resuelto (vs. F1): `useWhatsappMessages` pollea cada 5s; una
 * subida de varios MB dura más que un ciclo de poll, y el poll reemplaza el
 * array entero → borraría la burbuja optimista. Los envíos en vuelo viven en
 * `whatsappPendingSendsKey` — un slice que el poll NUNCA toca.
 *
 * `onSuccess` (heredado de F1, bug #5): `cancelQueries` (con `await`, ANTES
 * del `setQueryData`) aborta cualquier poll en vuelo del thread para que su
 * resultado stale no pise el append; el dedup por `id` cubre el caso inverso
 * (el poll ya trajo el mensaje). `onError` NO relanza — marca el pending
 * `failed` para que la burbuja ofrezca "Reintentar"/"Descartar".
 */
/** Bug BAJO #13c: `crypto.randomUUID` puede no existir (contexto no-seguro, navegador viejo) — mismo fallback que `makeDraftId` en `useComposerAttachments.ts`. */
function makeTempId(): string {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `optimistic:${uuid}`;
}

/**
 * Bug MEDIO #11: `onUploadProgress` de axios dispara en CADA tick de la
 * subida (pueden ser decenas por archivo grande), y cada tick hacía un
 * `setQueryData` que re-renderiza el thread entero. Throttle simple: el
 * primer tick siempre patchea (progreso inicial visible), los siguientes
 * solo si avanzaron >= 5 puntos desde el último patcheado, y completar
 * (fraction===1) siempre patchea (para que la barra llegue a 100% posta).
 */
function createProgressThrottle(onPatch: (fraction: number) => void) {
  let lastPatched: number | null = null;
  return (fraction: number) => {
    if (lastPatched !== null && fraction < 1 && fraction - lastPatched < 0.05) return;
    lastPatched = fraction;
    onPatch(fraction);
  };
}

export function useSendWhatsappMessage(id: string) {
  const qc = useQueryClient();
  const pendingKey = whatsappPendingSendsKey(id);

  type SendVars = { content: string; files: File[]; drafts: DraftAttachment[]; tempId: string; convId: string; isPrivate: boolean };

  const mutation = useMutation({
    // Bug CRÍTICO #1 defensa (post-review-adversarial): TODAS las keys de
    // acá para abajo se derivan de `vars.convId` (capturado en `send`/`retry`
    // AL MOMENTO de disparar el envío), NUNCA del closure `id` de este hook.
    // Motivo: `Composer` (F1.5 Tanda 2) NO tenía `key={conversationId}` — al
    // cambiar de conversación sin desmontar, React re-renderiza esta MISMA
    // instancia de `useMutation` con un `id` nuevo, y TanStack Query actualiza
    // los callbacks (`onSuccess`/`onError`) al último closure disponible. Si
    // esos callbacks leyeran `id`/`pendingKey` del closure del hook, un envío
    // en vuelo de la conversación A terminaría resolviéndose (o marcándose
    // "failed") en el slice de la conversación B recién seleccionada.
    mutationFn: (vars: SendVars) => {
      const patchProgress = createProgressThrottle((fraction) => {
        qc.setQueryData<PendingSend[]>(whatsappPendingSendsKey(vars.convId), (old = []) =>
          old.map((p) => (p.tempId === vars.tempId ? { ...p, progress: fraction } : p)),
        );
      });
      return api.sendWhatsappMessage(vars.convId, {
        content: vars.content,
        files: vars.files,
        onUploadProgress: patchProgress,
        // messaging-inbox-notes F1.5 fase D (design §5): mirror EXACTO del
        // campo wire — el único cruce de nombre isPrivate(interno)→private
        // (wire) de todo el pipeline.
        private: vars.isPrivate,
      });
    },

    onMutate: (vars: SendVars) => {
      // Upsert por tempId: un `retry` reusa el tempId original (misma
      // burbuja, mismo lugar en el thread) — si ya existe, se actualiza en
      // vez de agregar una 2da fila duplicada.
      qc.setQueryData<PendingSend[]>(whatsappPendingSendsKey(vars.convId), (old = []) => {
        const next: PendingSend = { tempId: vars.tempId, content: vars.content, drafts: vars.drafts, progress: 0, status: 'sending', createdAt: new Date().toISOString(), isPrivate: vars.isPrivate };
        const exists = old.some((p) => p.tempId === vars.tempId);
        return exists ? old.map((p) => (p.tempId === vars.tempId ? next : p)) : [...old, next];
      });
    },

    onSuccess: async (message: WhatsappMessage, vars: SendVars) => {
      vars.drafts.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
      qc.setQueryData<PendingSend[]>(whatsappPendingSendsKey(vars.convId), (old = []) => old.filter((p) => p.tempId !== vars.tempId));
      await qc.cancelQueries({ queryKey: whatsappMessagesKey(vars.convId) });
      qc.setQueryData<WhatsappMessage[]>(whatsappMessagesKey(vars.convId), (old) => {
        const list = old ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
    },

    onError: (error: unknown, vars: SendVars) => {
      console.error('[whatsapp] sendMessage failed', error);
      qc.setQueryData<PendingSend[]>(whatsappPendingSendsKey(vars.convId), (old = []) =>
        old.map((p) => (p.tempId === vars.tempId ? { ...p, status: 'failed' as const } : p)),
      );
    },
  });

  const send = (
    input: { content: string; files: File[]; drafts: DraftAttachment[]; isPrivate?: boolean },
    opts?: { onSuccess?: () => void },
  ) => mutation.mutate({ ...input, isPrivate: input.isPrivate ?? false, tempId: makeTempId(), convId: id }, opts);

  const retry = (pending: PendingSend) => {
    // `onMutate` hace el upsert (misma tempId → reemplaza en el lugar,
    // vuelve a "sending"/progress 0) — no hace falta patchear acá antes.
    // `isPrivate` viaja del pending original (messaging-inbox-notes F1.5
    // fase D): reintentar una nota fallida sigue siendo una nota, nunca
    // "degrada" a reply.
    mutation.mutate({
      content: pending.content,
      files: pending.drafts.filter((d) => !d.error).map((d) => d.file),
      drafts: pending.drafts,
      tempId: pending.tempId,
      convId: id,
      isPrivate: pending.isPrivate,
    });
  };

  const discard = (pending: PendingSend) => {
    pending.drafts.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    qc.setQueryData<PendingSend[]>(pendingKey, (old = []) => old.filter((p) => p.tempId !== pending.tempId));
  };

  return { send, retry, discard, isError: mutation.isError, error: mutation.error };
}

/**
 * useSetConversationStatus(id) (messaging-inbox-productivity F1.5-C v1 —
 * RESOLVER/REABRIR) — `POST .../status` con optimistic UI: parchea `status`
 * en el detalle cacheado (`whatsappConversationKey`) Y en TODAS las páginas
 * cacheadas de la lista (`whatsappConversationsKey`) que contengan esa
 * conversación, ANTES de que la red resuelva.
 *
 * Rollback FIELD-SCOPED (hallazgo CRÍTICO #1, review adversarial F1.5-C2):
 * `onMutate` snapshotea SOLO el `status` previo (detalle + cada página de
 * lista, por convId) — NO el objeto/fila entera. `onError` restaura ESE
 * campo con un update funcional que preserva todo lo demás. Antes, el
 * snapshot era el objeto/fila COMPLETA: si otra mutation (`assignee`/`area`,
 * u otro `setStatus` de OTRA conversación) corría y se asentaba MIENTRAS
 * esta seguía en vuelo, el rollback de ESTA pisaba el cambio de la OTRA al
 * restaurar el snapshot viejo entero. Con field-scoping, dos mutaciones que
 * overlapean (mismo conv/dos campos, o dos convs/mismo campo) ya no se pisan.
 *
 * Mismo criterio que `useSendWhatsappMessage` (bug CRÍTICO #1 defensa): todas
 * las keys de cache se derivan de `vars.convId`, capturado en `setStatus` AL
 * MOMENTO del dispatch — nunca del closure `id` del hook. Sin esto, un
 * header sin `key={conversationId}` que cambiara de conversación MIENTRAS la
 * mutation está en vuelo resolvería el optimista (o el rollback) en el slice
 * de la conversación EQUIVOCADA.
 *
 * `onSettled` invalida (no solo asienta el optimista) TANTO en éxito como en
 * error: el detalle pollea cada 25s y la lista cada 15s (`useWhatsapp.ts`
 * header), pero el agente espera ver el cambio YA — invalidar fuerza un
 * refetch inmediato de ambas queries si están activas, que además es la
 * fuente de verdad final (el BE recién actualiza el mirror post-OK del POST
 * — el optimista es una promesa hasta ese refetch la confirma).
 */
type SetStatusVars = { status: WhatsappConversationStatus; convId: string };
type SetStatusContext = {
  convId: string;
  // `previousDetailStatus`/`previousListStatuses` son `string`, NO
  // `WhatsappConversationStatus` — reflejan el tipo ANCHO real del campo
  // cacheado (`WhatsappConversationListItem.status`/`.Detail.status`, legado
  // de Chatwoot, ver el tipo en `types/whatsapp.ts`), no el tipo angosto que
  // la UI puede DISPARAR (`WhatsappConversationStatus`, solo open/resolved).
  /** `undefined` = no había detalle cacheado al momento del optimista (nunca se tocó ese campo). */
  previousDetailStatus: string | undefined;
  /** Por página cacheada: el `status` previo de ESTA conversación en esa página (`undefined` = la fila no estaba ahí). */
  previousListStatuses: Array<[readonly unknown[], string | undefined]>;
};

export function useSetConversationStatus(id: string) {
  const qc = useQueryClient();

  // hallazgo MEDIUM #4 (review adversarial F1.5-C): TData es
  // `WhatsappConversationListItem`, NO `WhatsappConversationDetail` — el BE
  // real devuelve el shape de LISTA (ver `api.setConversationStatus`, sin
  // `canReply`/`clientContext`). Inerte hoy (nada de acá abajo lee `data`
  // más allá de `_data` descartado en `onSettled`), pero honesto: si algo
  // llegara a leer `mutation.data.canReply` compilaría igual y rompería en
  // runtime.
  const mutation = useMutation<WhatsappConversationListItem, unknown, SetStatusVars, SetStatusContext>({
    mutationFn: (vars) => api.setConversationStatus(vars.convId, vars.status),

    onMutate: async (vars) => {
      const detailKey = whatsappConversationKey(vars.convId);
      await qc.cancelQueries({ queryKey: detailKey });
      await qc.cancelQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });

      const previousDetailStatus = qc.getQueryData<WhatsappConversationDetail>(detailKey)?.status;
      qc.setQueryData<WhatsappConversationDetail>(detailKey, (old) =>
        old ? { ...old, status: vars.status } : old,
      );

      const previousLists = qc.getQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>({
        queryKey: WHATSAPP_CONVERSATIONS_ROOT,
      });
      const previousListStatuses: SetStatusContext['previousListStatuses'] = previousLists.map(([key, data]) => [
        key,
        data?.data.find((c) => c.id === vars.convId)?.status,
      ]);
      qc.setQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>(
        { queryKey: WHATSAPP_CONVERSATIONS_ROOT },
        (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === vars.convId ? { ...c, status: vars.status } : c)) }
            : old,
      );

      return { convId: vars.convId, previousDetailStatus, previousListStatuses };
    },

    onError: (_err, _vars, context) => {
      if (!context) return;
      qc.setQueryData<WhatsappConversationDetail>(whatsappConversationKey(context.convId), (current) =>
        current && context.previousDetailStatus !== undefined
          ? { ...current, status: context.previousDetailStatus }
          : current,
      );
      context.previousListStatuses.forEach(([key, previousStatus]) => {
        if (previousStatus === undefined) return; // la fila no estaba en esta página al momento del optimista: nada que revertir
        qc.setQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(key, (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === context.convId ? { ...c, status: previousStatus } : c)) }
            : old,
        );
      });
    },

    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: whatsappConversationKey(vars.convId) });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
      // inbox-views (Ola 1): resolver/reabrir mueve la conversación entre
      // vistas (all/mine/unattended/unassigned ↔ resolved) — refetch inmediato
      // de los badges del sub-menú, sin esperar el poll de 30s. En error
      // TAMBIÉN (onSettled): el counts key vive fuera del root de
      // conversaciones (ver su comentario), así que ninguna otra invalidación
      // lo cubre.
      void qc.invalidateQueries({ queryKey: whatsappViewCountsKey });
    },
  });

  /**
   * hallazgo MEDIUM #3 (review adversarial F1.5-C): `opts` es ADITIVO
   * (mismo patrón que `send`, arriba en este archivo) — se reenvía tal cual
   * al `mutate` de TanStack Query, que lo invoca EN ADICIÓN a los callbacks
   * de `useMutation` de arriba (`onError` de acá abajo NO reemplaza el
   * `onError` del rollback, corre después). Así el caller (`WhatsappInboxPage`)
   * puede surfacear el error (toast/banner) sin un `useEffect` aparte
   * observando `isError`/`error` reactivamente.
   */
  const setStatus = (
    status: WhatsappConversationStatus,
    opts?: { onError?: (error: unknown) => void },
  ) => mutation.mutate({ status, convId: id }, opts);

  return {
    setStatus,
    // Bug ALTO #2 (review adversarial F1.5-C): la MISMA instancia de
    // `useMutation` persiste entre renders del hook (no se remonta al
    // cambiar `id` — mismo criterio que el bug CRÍTICO #1 de
    // `useSendWhatsappMessage`, arriba). `mutation.isPending` crudo seguía
    // reflejando un request en vuelo de la conversación ANTERIOR después de
    // cambiar de selección — el botón de la conversación NUEVA quedaba
    // disabled+spinner por un request AJENO. `mutation.variables` (TanStack
    // Query v5) expone las variables del `mutate` en vuelo; comparar su
    // `convId` contra el `id` ACTUAL del hook scopea `isPending` a la
    // conversación que el caller realmente pidió.
    isPending: mutation.isPending && mutation.variables?.convId === id,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * useSetConversationAssignee(id) / useSetConversationArea(id)
 * (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN) — CLON estructural de
 * `useSetConversationStatus` (arriba): `PATCH .../assignee` y `PATCH .../area`
 * con optimistic UI idéntico — parchea el campo en el detalle cacheado
 * (`whatsappConversationKey`) Y en TODAS las páginas cacheadas de la lista
 * (`whatsappConversationsKey`) que contengan esa conversación, ANTES de que
 * la red resuelva. `onSettled` invalida SIEMPRE (éxito o error) — el
 * detalle/lista pollean, pero el agente espera ver el cambio YA, y el
 * polling de Chatwoot NUNCA trae assignee/area (son locales del BE) — sin
 * este invalidate, un optimista que el BE rechazara en silencio (edge de
 * red) quedaría "colgado" hasta el próximo poll.
 *
 * Rollback FIELD-SCOPED (hallazgo CRÍTICO #1, review adversarial F1.5-C2):
 * mismo criterio que `useSetConversationStatus` — `onMutate` snapshotea SOLO
 * el campo propio (`assignee`/`area`, NO el objeto/fila entera). `onError`
 * restaura ESE campo con un update funcional que preserva todo lo demás.
 * Antes, el snapshot era el objeto/fila COMPLETA: si `setAssignee`/`setArea`
 * (u otra instancia del mismo hook para OTRA conversación) corría y se
 * asentaba MIENTRAS esta mutation seguía en vuelo, el rollback pisaba ese
 * cambio ajeno al restaurar el snapshot viejo entero. El campo es
 * `WhatsappAssignee | null` / `WhatsappArea | null` — `null` es un valor
 * VÁLIDO ("sin asignar"/"sin área"), así que el sentinel de "no había
 * snapshot" es `undefined` (chequeado con `!== undefined`, NUNCA `??`, que
 * trataría `null` como ausente y perdería un rollback legítimo a "sin asignar").
 *
 * Se reciben `WhatsappAssignee | null` / `WhatsappArea | null` COMPLETOS (no
 * solo el id) porque el caller (`ConversationAssignmentControls`) ya conoce
 * el objeto elegido del catálogo (`useAssignableUsers`/`useMessagingAreas`) —
 * eso permite que el optimista pinte el NOMBRE/COLOR correcto al instante, sin
 * esperar la respuesta del PATCH (que solo necesita el id en el wire).
 *
 * Bug CRÍTICO #1 defensa (mismo criterio que `useSendWhatsappMessage`/
 * `useSetConversationStatus`): todas las keys de acá para abajo se derivan de
 * `vars.convId` (capturado en `setAssignee`/`setArea` AL MOMENTO del
 * dispatch), NUNCA del closure `id` del hook — evita que un cambio de
 * conversación MIENTRAS la mutation está en vuelo resuelva (o haga rollback)
 * en el slice de la conversación EQUIVOCADA (memoria `inbox-key-por-conversacion`).
 */
type SetAssigneeVars = { assignee: WhatsappAssignee | null; convId: string };
type SetAreaVars = { area: WhatsappArea | null; convId: string };
type SetAssigneeContext = {
  convId: string;
  /** `undefined` = no había detalle cacheado (nunca se tocó ese campo); `null` = "sin asignar" es un valor válido a restaurar. */
  previousDetailAssignee: WhatsappAssignee | null | undefined;
  previousListAssignees: Array<[readonly unknown[], WhatsappAssignee | null | undefined]>;
};
type SetAreaContext = {
  convId: string;
  previousDetailArea: WhatsappArea | null | undefined;
  previousListAreas: Array<[readonly unknown[], WhatsappArea | null | undefined]>;
};

export function useSetConversationAssignee(id: string) {
  const qc = useQueryClient();

  const mutation = useMutation<WhatsappConversationListItem, unknown, SetAssigneeVars, SetAssigneeContext>({
    mutationFn: (vars) => api.setConversationAssignee(vars.convId, vars.assignee?.id ?? null),

    onMutate: async (vars) => {
      const detailKey = whatsappConversationKey(vars.convId);
      await qc.cancelQueries({ queryKey: detailKey });
      await qc.cancelQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });

      const previousDetailAssignee = qc.getQueryData<WhatsappConversationDetail>(detailKey)?.assignee;
      qc.setQueryData<WhatsappConversationDetail>(detailKey, (old) =>
        old ? { ...old, assignee: vars.assignee } : old,
      );

      const previousLists = qc.getQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>({
        queryKey: WHATSAPP_CONVERSATIONS_ROOT,
      });
      const previousListAssignees: SetAssigneeContext['previousListAssignees'] = previousLists.map(([key, data]) => [
        key,
        data?.data.find((c) => c.id === vars.convId)?.assignee,
      ]);
      qc.setQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>(
        { queryKey: WHATSAPP_CONVERSATIONS_ROOT },
        (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === vars.convId ? { ...c, assignee: vars.assignee } : c)) }
            : old,
      );

      return { convId: vars.convId, previousDetailAssignee, previousListAssignees };
    },

    onError: (_err, _vars, context) => {
      if (!context) return;
      qc.setQueryData<WhatsappConversationDetail>(whatsappConversationKey(context.convId), (current) =>
        current && context.previousDetailAssignee !== undefined
          ? { ...current, assignee: context.previousDetailAssignee }
          : current,
      );
      context.previousListAssignees.forEach(([key, previousAssignee]) => {
        if (previousAssignee === undefined) return; // la fila no estaba en esta página al momento del optimista: nada que revertir
        qc.setQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(key, (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === context.convId ? { ...c, assignee: previousAssignee } : c)) }
            : old,
        );
      });
    },

    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: whatsappConversationKey(vars.convId) });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
      // inbox-views (Ola 1): asignar/desasignar mueve la conversación entre
      // "Mi bandeja"/"Sin asignar" — mismo criterio que useSetConversationStatus.
      void qc.invalidateQueries({ queryKey: whatsappViewCountsKey });
    },
  });

  const setAssignee = (
    assignee: WhatsappAssignee | null,
    opts?: { onError?: (error: unknown) => void },
  ) => mutation.mutate({ assignee, convId: id }, opts);

  return {
    setAssignee,
    isPending: mutation.isPending && mutation.variables?.convId === id,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useSetConversationArea(id: string) {
  const qc = useQueryClient();

  const mutation = useMutation<WhatsappConversationListItem, unknown, SetAreaVars, SetAreaContext>({
    mutationFn: (vars) => api.setConversationArea(vars.convId, vars.area?.id ?? null),

    onMutate: async (vars) => {
      const detailKey = whatsappConversationKey(vars.convId);
      await qc.cancelQueries({ queryKey: detailKey });
      await qc.cancelQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });

      const previousDetailArea = qc.getQueryData<WhatsappConversationDetail>(detailKey)?.area;
      qc.setQueryData<WhatsappConversationDetail>(detailKey, (old) =>
        old ? { ...old, area: vars.area } : old,
      );

      const previousLists = qc.getQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>({
        queryKey: WHATSAPP_CONVERSATIONS_ROOT,
      });
      const previousListAreas: SetAreaContext['previousListAreas'] = previousLists.map(([key, data]) => [
        key,
        data?.data.find((c) => c.id === vars.convId)?.area,
      ]);
      qc.setQueriesData<WhatsappPaginatedResult<WhatsappConversationListItem>>(
        { queryKey: WHATSAPP_CONVERSATIONS_ROOT },
        (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === vars.convId ? { ...c, area: vars.area } : c)) }
            : old,
      );

      return { convId: vars.convId, previousDetailArea, previousListAreas };
    },

    onError: (_err, _vars, context) => {
      if (!context) return;
      qc.setQueryData<WhatsappConversationDetail>(whatsappConversationKey(context.convId), (current) =>
        current && context.previousDetailArea !== undefined
          ? { ...current, area: context.previousDetailArea }
          : current,
      );
      context.previousListAreas.forEach(([key, previousArea]) => {
        if (previousArea === undefined) return; // la fila no estaba en esta página al momento del optimista: nada que revertir
        qc.setQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(key, (old) =>
          old
            ? { ...old, data: old.data.map((c) => (c.id === context.convId ? { ...c, area: previousArea } : c)) }
            : old,
        );
      });
    },

    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: whatsappConversationKey(vars.convId) });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
    },
  });

  const setArea = (
    area: WhatsappArea | null,
    opts?: { onError?: (error: unknown) => void },
  ) => mutation.mutate({ area, convId: id }, opts);

  return {
    setArea,
    isPending: mutation.isPending && mutation.variables?.convId === id,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * useAssignableUsers / useMessagingAreas (messaging-inbox-assignment F1.5-C2)
 * — catálogos simples (GET plano, sin params). `staleTime` alto: el catálogo
 * de agentes/áreas cambia poco (altas/bajas de RBAC, ABM de áreas), no hace
 * falta pollear — mismo criterio que `useTicketAreas`/`useRbacUsers`.
 * `getMessagingAreas` pega al MISMO endpoint que usaría un futuro
 * `useTicketAreas` de messaging — no se comparte el hook con Tickets porque
 * `useTicketAreas` pega a `/ticket-areas` (namespace propio), no a
 * `/messaging/areas`; el catálogo subyacente es compartido en el BE, no el
 * endpoint FE.
 *
 * `enabled` (hallazgo LOW #6, review adversarial): el caller (`WhatsappInboxPage`)
 * lo ata al permiso `messaging.send` (mismo gate que `<Can permission=
 * "messaging.send">` envuelve alrededor de `ConversationAssignmentControls`,
 * `MessageThread.tsx`) — no tiene sentido pedir el catálogo de agentes/áreas
 * si el usuario no puede asignar. Default `true` (cero regresión: cualquier
 * caller existente que llame sin argumento sigue fetcheando igual que antes).
 */
export function useAssignableUsers(enabled: boolean = true) {
  return useQuery({
    queryKey: whatsappAssignableUsersKey,
    queryFn: api.getAssignableUsers,
    staleTime: 60_000,
    enabled,
  });
}

export function useMessagingAreas(enabled: boolean = true) {
  return useQuery({
    queryKey: whatsappAreasKey,
    queryFn: api.getMessagingAreas,
    staleTime: 60_000,
    enabled,
  });
}

/**
 * useInboxClientContext(conversationId, clientId) — messaging-inbox-v2 F1.5
 * (RICH-1..6, design §3.1/§3.2, tasks F2). SWR de la deuda en 2 fases:
 *
 * 1. Query PRIMARIA (mirror-fast): pinta el número al instante desde el
 *    mirror, `refetchInterval:false` — a diferencia de los otros 3 hooks de
 *    este archivo, el panel NO pollea (el dato del cliente cambia lento).
 * 2. Query de REFRESH de balance (background): gateada por
 *    `client.balance.stale === true` que trajo la primaria. Pide el mismo
 *    endpoint con `{refreshBalance: true}` (dispara el refresh vivo de
 *    Gestión Real en el BE, RICH-4) y, al resolver, PARCHEA solo `balance` en
 *    el cache de la primaria (`qc.setQueryData`) — el resto de `client`
 *    (identidad, contratos, tickets, etc.) NO se toca, así el número
 *    transiciona in-place sin re-renderizar todo el panel.
 *
 * TanStack Query v5 removió `onSuccess`/`onError` de `useQuery` (solo siguen
 * en `useMutation`) — el patch de cache se hace acá vía `useEffect` reaccionando
 * a `balanceQuery.data`, no vía callback de la query.
 *
 * `isRefreshingBalance` = `balanceQuery.isFetching` → alimenta el pill
 * "actualizando…" (design §8.4b) sin bloquear jamás el primer paint.
 */
export function useInboxClientContext(conversationId: string | null, clientId: string | null) {
  const qc = useQueryClient();
  const enabled = !!conversationId;
  const primaryKey = whatsappClientContextKey(conversationId ?? '', clientId);

  const query = useQuery({
    queryKey: primaryKey,
    queryFn: () => api.getInboxClientContext(conversationId!, clientId ?? undefined),
    enabled,
    refetchInterval: false,
  });

  const staleBalance = query.data?.client?.balance.stale === true;

  const balanceQuery = useQuery({
    queryKey: [...primaryKey, 'balanceRefresh'],
    queryFn: () => api.getInboxClientContext(conversationId!, clientId ?? undefined, { refreshBalance: true }),
    enabled: enabled && staleBalance,
    refetchInterval: false,
  });

  useEffect(() => {
    const fresh = balanceQuery.data?.client;
    if (!fresh) return;
    qc.setQueryData<WhatsappInboxClientContext>(primaryKey, (old) => {
      if (!old?.client) return old;
      return { ...old, client: { ...old.client, balance: fresh.balance } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primaryKey se deriva de conversationId/clientId (ya en deps); incluir el array recrearía el efecto en cada render.
  }, [balanceQuery.data, qc, conversationId, clientId]);

  return {
    ...query,
    isRefreshingBalance: balanceQuery.isFetching,
    // Bug #2 fix (post-review-adversarial): expone el estado de error de la
    // query de REFRESH (2da fase), separado del `isError` de la primaria —
    // el container lo usa para el chip "no se pudo actualizar" sin confundir
    // "el refresh de balance falló" con "la query primaria falló".
    balanceRefreshFailed: balanceQuery.isError,
  };
}

/**
 * useSendableTemplates(enabled) (inbox-template-send, design D11/PICK-1) —
 * catálogo de templates para el picker del composer (CTA "Enviar template"
 * en ventana expirada). Molde `useTemplates(enabled)` de `useBulkMessaging.ts`
 * — MISMO criterio de `staleTime` (60s, el catálogo cambia poco) pero query
 * key/endpoint PROPIOS (`/messaging/send-templates`, gate `messaging.send` —
 * design D7, NO el `/messaging/bulk/templates` de `messaging.templates`).
 * `enabled` lo ata el caller (`TemplateSendPanel`) a si el panel está abierto
 * — sin sentido pedir el catálogo si el agente todavía no clickeó el CTA.
 */
export function useSendableTemplates(enabled: boolean) {
  return useQuery({
    queryKey: whatsappSendTemplatesKey,
    queryFn: api.listSendableTemplates,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * useSendWhatsappTemplate(id) (inbox-template-send, design D11/SEND-1) —
 * envío one-off de un template desde el hilo abierto. A diferencia de
 * `useSendWhatsappMessage` (optimistic UI + `pendingSends`, envíos largos con
 * media), acá el flujo es MODAL-BLOQUEANTE: confirm → spinner en el botón del
 * panel → cierre on-success (design D11, "sin burbuja optimista"). El POST es
 * corto (JSON), no justifica un slice de cache propio.
 *
 * `onSuccess` clona el patrón de `useSendWhatsappMessage.onSuccess` (bug
 * CRÍTICO #1 defensa, memoria `inbox-key-por-conversacion`): TODAS las keys
 * de acá para abajo se derivan de `vars.convId` (capturado en `sendTemplate`
 * AL MOMENTO de disparar), NUNCA del closure `id` del hook — si el agente
 * cambia de conversación mientras el POST sigue en vuelo, el resultado
 * aterriza en el slice de la conversación que ORIGINÓ el envío, no en la que
 * está seleccionada ahora. `await cancelQueries` ANTES del append asegura que
 * un poll en vuelo no pise el mensaje recién agregado; el dedup por `id`
 * cubre el caso inverso (el poll de 5s ya lo trajo).
 *
 * `isPending` scoped por convId (molde `useSetConversationStatus`,
 * `useWhatsapp.ts:387`): la MISMA instancia de `useMutation` persiste entre
 * renders del hook — comparar `mutation.variables?.convId` contra el `id`
 * ACTUAL evita que el botón confirm de una conversación NUEVA quede
 * disabled+spinner por un envío ajeno en vuelo de la conversación anterior.
 *
 * La `idempotencyKey` (contrato H1, design D5/D11) vive en el ESTADO del
 * `TemplateSendPanel` (generada al abrir el panel, reusada en reintentos) —
 * este hook sólo la threadea tal cual en el body del POST, nunca la genera.
 */
export function useSendWhatsappTemplate(id: string) {
  const qc = useQueryClient();

  type SendTemplateVars = { templateRef: string; variables: Record<string, string>; idempotencyKey: string; convId: string };

  const mutation = useMutation({
    mutationFn: (vars: SendTemplateVars) =>
      api.sendWhatsappTemplate(vars.convId, {
        templateRef: vars.templateRef,
        variables: vars.variables,
        idempotencyKey: vars.idempotencyKey,
      }),

    onSuccess: async (message: WhatsappMessage, vars: SendTemplateVars) => {
      await qc.cancelQueries({ queryKey: whatsappMessagesKey(vars.convId) });
      qc.setQueryData<WhatsappMessage[]>(whatsappMessagesKey(vars.convId), (old) => {
        const list = old ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
    },
  });

  const sendTemplate = (
    input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string },
    opts?: { onSuccess?: (message: WhatsappMessage) => void; onError?: (error: unknown) => void },
  ) => mutation.mutate({ ...input, convId: id }, opts);

  return {
    sendTemplate,
    isPending: mutation.isPending && mutation.variables?.convId === id,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
