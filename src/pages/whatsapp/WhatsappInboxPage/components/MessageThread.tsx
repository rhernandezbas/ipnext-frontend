import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { Skeleton } from './Skeleton';
import type { WhatsappMessage } from '@/types/whatsapp';
import styles from './MessageThread.module.css';

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
export function MessageThread({ conversationId, contactName, messages, isLoading, isError = false, onBack }: MessageThreadProps) {
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
    for (const m of messages) {
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
  }, [messages, conversationId]);

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
    for (const m of messages) {
      if (newIds.has(m.id)) {
        order.set(m.id, i);
        i++;
      }
    }
    return order;
  }, [messages, newIds]);

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

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const isNewConversation = prevConversationIdForScrollRef.current !== conversationId;
    prevConversationIdForScrollRef.current = conversationId;

    const lastMessage = messages[messages.length - 1];
    const isOwnSend = lastMessage?.direction === 'outbound';

    const list = listRef.current;
    const isNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;

    if (isNewConversation || isOwnSend || isNearBottom) {
      // jsdom no implementa `scrollIntoView` de fábrica (tests que no lo
      // mockean explícitamente lo dejan `undefined`) — optional chaining
      // preserva el guard original.
      bottom.scrollIntoView?.({ block: 'end' });
    }
  }, [messages, conversationId]);

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

        {!isLoading && !isError && messages.length === 0 && (
          <p className={styles.emptyState}>Sin mensajes aún.</p>
        )}

        {!isLoading && !isError && messages.length > 0 && (
          <div
            ref={listRef}
            className={styles.list}
            data-testid="message-thread-list"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isNew={newIds.has(m.id)}
                staggerIndex={newIdsOrder.get(m.id) ?? 0}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
