import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as api from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type {
  DraftAttachment,
  PendingSend,
  WhatsappInboxClientContext,
  WhatsappMessage,
  WhatsappPaginatedQuery,
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
