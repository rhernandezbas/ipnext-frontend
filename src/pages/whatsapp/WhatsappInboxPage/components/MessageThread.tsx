import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { Skeleton } from './Skeleton';
import type { PendingSend, WhatsappMessage } from '@/types/whatsapp';
import styles from './MessageThread.module.css';

/**
 * Bug ALTO #5 (post-review-adversarial): dedup HEURÍSTICO entre un
 * `PendingSend` (optimista, `tempId`) y un `WhatsappMessage` real (`id`) del
 * poll. `onSuccess` de `useSendWhatsappMessage` remueve el pending y appendea
 * el mensaje real bajo `await cancelQueries` — pero si el poll de 5s trae el
 * mensaje real ANTES de que esa promesa resuelva, `messages` YA incluye el
 * real mientras el pending sigue en el slice → 2 burbujas para el mismo
 * envío. Match: misma dirección outbound + mismo `content` + `sentAt` del
 * real dentro de una ventana chica alrededor del `createdAt` del pending.
 *
 * Gap documentado: este matching es una heurística (contenido+tiempo), no
 * una correlación determinística — dos envíos legítimos con el MISMO texto
 * en la MISMA ventana (raro, pero posible) colapsarían a 1 burbuja. El fix
 * determinístico real sería el BE devolviendo/ecoeando un `clientMessageId`
 * (generado acá, viajando en el POST) que el mensaje real conservara — así
 * el match sería por id exacto, no por heurística. Ese cambio de contrato
 * excede esta tanda (requiere tocar el BE); queda como deuda conocida.
 */
const DEDUP_WINDOW_MS = 30_000;

function isLikelyDuplicateOfReal(pending: PendingSend, messages: WhatsappMessage[]): boolean {
  const pendingTime = new Date(pending.createdAt).getTime();
  return messages.some((m) => {
    if (m.direction !== 'outbound') return false;
    if (m.content !== pending.content) return false;
    const diff = Math.abs(new Date(m.sentAt).getTime() - pendingTime);
    return diff <= DEDUP_WINDOW_MS;
  });
}

/**
 * toOptimisticMessage (messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §5.3) — mapea un `PendingSend` (envío en vuelo) a un
 * `WhatsappMessage` de forma que `MessageBubble` lo renderice con el MISMO
 * `MediaAttachments`/`MediaAttachment` del inbound (reuso puro). `status:
 * 'downloaded'` (NUNCA 'pending') porque el binario local YA existe vía
 * objectURL — 'pending' pintaría el skeleton sin sentido.
 */
function toOptimisticMessage(pending: PendingSend): WhatsappMessage {
  return {
    id: pending.tempId,
    direction: 'outbound',
    content: pending.content,
    senderName: null,
    sentAt: pending.createdAt,
    attachments: pending.drafts
      .filter((d) => d.error === null)
      .map((d) => ({
        id: `${pending.tempId}:${d.id}`,
        fileType: d.fileType,
        contentType: d.file.type,
        filename: d.file.name,
        fileSize: d.file.size,
        width: null,
        height: null,
        status: 'downloaded' as const,
        url: d.previewUrl ?? '',
        thumbUrl: null,
      })),
  };
}

interface MessageThreadProps {
  /** `null` cuando no hay conversación seleccionada todavía (estado inicial). */
  conversationId: string | null;
  contactName: string | null;
  messages: WhatsappMessage[];
  isLoading: boolean;
  isError?: boolean;
  /**
   * Bug #8 (mobile trap, post-review-adversarial): en ≤860px `WhatsappInboxPage`
   * oculta `.listCol` mientras hay selección (design §2) sin dar forma de
   * volver — `selectedId` nunca se limpiaba. Cuando el padre pasa `onBack`
   * (siempre lo hace, `WhatsappInboxPage.tsx`), se renderiza un botón en el
   * header del thread que llama `setSelectedId(null)`. Se muestra en TODOS
   * los tamaños (no gateado por CSS/breakpoint) — inofensivo en desktop,
   * imprescindible en mobile, y así queda 100% testeable sin Playwright.
   */
  onBack?: () => void;
  /**
   * Fix bug CRÍTICO #1 (post-review-adversarial): `WhatsappInboxPage` (FB4)
   * es quien tiene `queryClient`+`conversationId` para invalidar la query del
   * thread — acá solo se threadea el callback hacia cada `MessageBubble`
   * (mismo criterio que `onBack`, presentacional puro, sin react-query).
   */
  onRetryAttachment?: () => void;
  /**
   * Envíos en vuelo (messaging-inbox-v2-media F1.5 fase A, Tanda 2, design
   * §6.3) — se renderizan DESPUÉS de `messages` (son los más nuevos, aún sin
   * confirmar). Default `[]` → cero regresión para cualquier consumidor que
   * no los pase todavía.
   */
  pendingSends?: PendingSend[];
  /** "Reintentar" de una burbuja `failed` — recibe el `PendingSend` entero (drafts incluidos, para re-mutar). */
  onRetryPending?: (pending: PendingSend) => void;
  /** "Descartar" de una burbuja `failed`. */
  onDiscardPending?: (pending: PendingSend) => void;
}

/**
 * MessageThread — panel central del thread (messaging-inbox F1, design
 * §1/§7, THREAD-1, A11Y-1). Presentacional: `WhatsappInboxPage` (FB4) es
 * quien llama a `useWhatsappConversation`/`useWhatsappMessages` (design §1) —
 * el "fetch on open" (`enabled: !!id`) y el polling pausado sin foco ya los
 * resuelven esos hooks (FB1); acá solo se decide CÓMO se ve el resultado.
 *
 * Detecta mensajes "nuevos" (llegados por polling, no en la carga inicial)
 * con el mismo patrón `seenIds`/`justAdded` que `TicketCommentsTimeline`
 * (`seenIdsRef` + ventana de 600ms) para no re-animar el historial completo
 * en cada render. El set se resetea cuando cambia `conversationId` para que
 * el historial de la conversación recién abierta tampoco se marque "nuevo".
 */
export function MessageThread({
  conversationId,
  contactName,
  messages,
  isLoading,
  isError = false,
  onBack,
  onRetryAttachment,
  pendingSends = [],
  onRetryPending,
  onDiscardPending,
}: MessageThreadProps) {
  // Merge server + pending (design §6.3): los pending van DESPUÉS (son los
  // más nuevos, aún sin confirmar). `pendingById` permite recuperar el
  // `PendingSend` original al renderizar (para bindear onRetry/onDiscard con
  // SU pending), sin mutar la forma de `WhatsappMessage`.
  // Bug ALTO #5: se filtran los pendings que ya tienen un mensaje real
  // equivalente en `messages` (ver `isLikelyDuplicateOfReal`) ANTES de
  // mapearlos a filas — evita la burbuja duplicada en la carrera
  // poll-vs-onSuccess. `pendingById` se deriva del MISMO set filtrado: un
  // pending deduplicado no debe seguir prestando su `deliveryStatus`/retry a
  // ninguna fila (ya no genera una).
  const visiblePendingSends = useMemo(
    () => pendingSends.filter((p) => !isLikelyDuplicateOfReal(p, messages)),
    [pendingSends, messages],
  );
  const pendingById = useMemo(() => new Map(visiblePendingSends.map((p) => [p.tempId, p])), [visiblePendingSends]);
  const rows = useMemo(
    () => [...messages, ...visiblePendingSends.map(toOptimisticMessage)],
    [messages, visiblePendingSends],
  );

  const seenIdsRef = useRef<Set<string>>(new Set());
  const prevConversationIdRef = useRef<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Ref APARTE de `prevConversationIdRef` (esa ya se actualiza en el efecto de
  // arriba, que corre ANTES que este en el mismo commit — para cuando este
  // efecto lea `prevConversationIdRef.current` ya estaría igualado a
  // `conversationId`, rompiendo la detección de "conversación recién abierta").
  const prevConversationIdForScrollRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevConversationIdRef.current !== conversationId) {
      seenIdsRef.current = new Set();
      prevConversationIdRef.current = conversationId;
    }

    // Fixed BEFORE the loop — checking `seenIdsRef.current.size > 0` DURING the
    // loop would flag the 2nd+ item of the very first batch as "new" (size
    // stops being 0 the moment the 1st item gets added mid-iteration).
    const isInitialLoad = seenIdsRef.current.size === 0;
    const fresh = new Set<string>();
    for (const m of rows) {
      if (!seenIdsRef.current.has(m.id)) {
        if (!isInitialLoad) fresh.add(m.id);
        seenIdsRef.current.add(m.id);
      }
    }

    if (fresh.size > 0) {
      setNewIds(fresh);
      const t = setTimeout(() => setNewIds(new Set()), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [rows, conversationId]);

  // BUG FIX (post-review-adversarial, componentes — bug #2): `staggerIndex`
  // NO puede ser el índice absoluto de `messages.map` — en un thread de 20+
  // mensajes, una única burbuja nueva heredaba el índice del array entero
  // (ej. 20) y el delay `staggerIndex*40ms` (MessageBubble) la dejaba
  // invisible ~800ms (`fill-mode:both` la mantiene en `opacity:0` hasta que
  // arranca la animación). El stagger tiene que ser 0-based DENTRO del
  // batch de mensajes nuevos (`newIds`), en el orden en que aparecen en el
  // array — así el PRIMER mensaje nuevo siempre entra con delay 0,
  // cascadeando +40ms solo entre los que llegaron juntos.
  const newIdsOrder = useMemo(() => {
    const order = new Map<string, number>();
    let i = 0;
    for (const m of rows) {
      if (newIds.has(m.id)) {
        order.set(m.id, i);
        i++;
      }
    }
    return order;
  }, [rows, newIds]);

  // BUG FIX (post-review-adversarial, review-animations de Emil — bug #7):
  // el `scrollIntoView` incondicional pateaba al fondo en CADA poll (~5s),
  // aunque el agente hubiera scrolleado para arriba a leer historial —
  // literalmente le arrancaba el thread de las manos. Ahora solo se
  // auto-scrollea cuando: (a) se acaba de abrir esta conversación (o el
  // componente recién montó), (b) el último mensaje del array es un envío
  // propio (`outbound` — el agente espera verlo, es la razón por la que
  // escribió), o (c) el usuario YA estaba cerca del fondo (no interrumpe una
  // lectura de historial en curso). `listRef` mide el contenedor scrolleable
  // real (`.list`), no `.panel` (ese es fijo, `overflow:hidden`).
  // Fix re-review fase 2 (edge menor, mitigación documentada): la distancia
  // al fondo se mide DESPUÉS de que el mensaje nuevo ya está en el DOM
  // (`scrollHeight` ya creció con el mensaje recién agregado, `scrollTop` NO
  // se reajusta solo — el navegador no re-ancla el scroll por vos). Un
  // inbound "alto" (mensaje largo, con salto de línea, etc.) puede empujar
  // la distancia post-crecimiento por encima de un umbral angosto aunque el
  // usuario estuviera efectivamente pegado al fondo ANTES de que ese mensaje
  // llegara. Medir la posición realmente "antes" del commit del DOM
  // requeriría trackear el scroll de forma continua vía un listener
  // `scroll` independiente del efecto de `messages` (más invasivo, y
  // incompatible con cómo los tests existentes fuerzan `scrollHeight`/
  // `scrollTop` directo sobre el nodo para simular la posición del usuario).
  // Mitigación pragmática: subir el umbral de 80px a 120px — cubre el salto
  // de altura típico de un mensaje largo sin convertir en "near bottom" a un
  // usuario que genuinamente scrolleó bastante para leer historial viejo.
  const NEAR_BOTTOM_THRESHOLD_PX = 120;

  // Bug MEDIO #11 (post-review-adversarial): `onUploadProgress` patchea el
  // `PendingSend` en cada tick (ya throttleado a nivel hook, pero igual
  // ocurre varias veces por subida) — cada patch crea una nueva referencia
  // de `pendingSends`/`rows`, y el efecto de abajo estaba en `[rows, ...]`:
  // recalculaba `isNearBottom`/`scrollIntoView` en CADA tick de progreso,
  // aunque no haya ninguna fila nueva. La identidad real que importa para
  // decidir "¿hay que scrollear?" es el CONJUNTO de ids de `rows` (agregar o
  // quitar una fila), no el contenido de una fila existente — `rowIdsKey`
  // solo cambia cuando efectivamente entra/sale una fila.
  const rowIdsKey = useMemo(() => rows.map((r) => r.id).join('|'), [rows]);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const isNewConversation = prevConversationIdForScrollRef.current !== conversationId;
    prevConversationIdForScrollRef.current = conversationId;

    const lastMessage = rows[rows.length - 1];
    const isOwnSend = lastMessage?.direction === 'outbound';

    const list = listRef.current;
    const isNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;

    if (isNewConversation || isOwnSend || isNearBottom) {
      // jsdom no implementa `scrollIntoView` de fábrica (tests que no lo
      // mockean explícitamente lo dejan `undefined`) — optional chaining
      // preserva el guard original.
      bottom.scrollIntoView?.({ block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rows` se lee dentro (closure) a propósito; el efecto solo debe RE-EJECUTARSE cuando cambia `rowIdsKey` (entra/sale una fila), no en cada tick de progreso de un pending existente (bug #11).
  }, [rowIdsKey, conversationId]);

  if (!conversationId) {
    return (
      <div className={styles.panel}>
        <p className={styles.placeholder}>Seleccioná una conversación para ver los mensajes.</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* `key` fuerza un remount de este subárbol en cada cambio de conversación
          — así el crossfade (design §7 row 3, 160ms) se re-dispara siempre,
          sin lógica JS extra. Los hooks de arriba (seenIds/newIds) viven en la
          instancia del COMPONENTE, no en este nodo, así que no se resetean por
          esto — el reset real pasa por prevConversationIdRef. */}
      <div className={styles.swap} key={conversationId} data-testid="message-thread-swap">
        <header className={styles.header}>
          {onBack && (
            <button
              type="button"
              className={styles.backButton}
              onClick={onBack}
              aria-label="Volver a la lista de conversaciones"
            >
              ◀
            </button>
          )}
          <span className={styles.contactName}>{contactName ?? 'Contacto'}</span>
        </header>

        {isLoading && (
          <div className={styles.loadingState}>
            <p className={styles.loadingText}>Cargando mensajes…</p>
            <Skeleton width="55%" height={36} />
            <Skeleton width="40%" height={36} className={styles.skeletonRight} />
          </div>
        )}

        {!isLoading && isError && (
          <p className={styles.errorState} role="alert">
            No se pudieron cargar los mensajes.
          </p>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <p className={styles.emptyState}>Sin mensajes aún.</p>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div
            ref={listRef}
            className={styles.list}
            data-testid="message-thread-list"
            aria-live="polite"
            aria-atomic="false"
          >
            {rows.map((m) => {
              // Solo los rows derivados de un PendingSend (id === tempId)
              // reciben deliveryStatus/progreso/retry/discard — los mensajes
              // REALES del server nunca están en `pendingById` (design §5.3).
              const pending = pendingById.get(m.id);
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isNew={newIds.has(m.id)}
                  staggerIndex={newIdsOrder.get(m.id) ?? 0}
                  onRetryAttachment={onRetryAttachment}
                  deliveryStatus={pending?.status}
                  uploadProgress={pending?.progress}
                  onRetry={pending ? () => onRetryPending?.(pending) : undefined}
                  onDiscard={pending ? () => onDiscardPending?.(pending) : undefined}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
