import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as api from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type { WhatsappInboxClientContext, WhatsappMessage, WhatsappPaginatedQuery } from '@/types/whatsapp';

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
 * COMPOSER-1 — envío de un mensaje. `onSuccess` appendea la respuesta 201 (ya
 * el `ChatMessageDto` persistido) directo al cache del thread — instantáneo,
 * sin reconciliar porque el próximo poll reemplaza el array completo por la
 * versión del server — e invalida SOLO la lista (barato, evita recomputar
 * `preview`/`lastMessageAt` en el cliente). NO invalida `conversation(id)`:
 * `canReply` no cambia al enviar, el próximo poll lo confirma igual.
 *
 * BUG FIX (post-review-adversarial — bug #5, race del envío): `useWhatsappMessages`
 * pollea en paralelo (independiente de esta mutation). Si un poll ya estaba
 * en vuelo cuando el POST resolvía, su respuesta (sin el mensaje nuevo
 * todavía, por lag del mirror) podía aterrizar DESPUÉS del `setQueryData` de
 * acá y pisarlo — el mensaje "se manda y desaparece" hasta el próximo poll.
 * `cancelQueries` (con `await`, ANTES del `setQueryData`) aborta ese query en
 * vuelo para que su resultado stale nunca llegue a aplicarse. El dedup por
 * `id` cubre el caso inverso: si el poll SÍ ganó la carrera y ya trajo el
 * mensaje antes de que este `onSuccess` corra, no se duplica.
 *
 * `onError` NO relanza — 422 `MESSAGING_WINDOW_EXPIRED` / 503
 * `CHATWOOT_UNAVAILABLE` quedan en `mutation.error`/`isError` para que el
 * composer (FB3) los muestre sin necesitar try/catch (el interceptor global
 * de `axios-client.ts` solo cubre 401).
 */
export function useSendWhatsappMessage(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => api.sendWhatsappMessage(id, content),
    onSuccess: async (message: WhatsappMessage) => {
      await qc.cancelQueries({ queryKey: whatsappMessagesKey(id) });
      qc.setQueryData<WhatsappMessage[]>(whatsappMessagesKey(id), (old) => {
        const list = old ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
      void qc.invalidateQueries({ queryKey: [...WHATSAPP_CONVERSATIONS_ROOT] });
    },
    onError: (error: unknown) => {
      console.error('[whatsapp] sendMessage failed', error);
    },
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
