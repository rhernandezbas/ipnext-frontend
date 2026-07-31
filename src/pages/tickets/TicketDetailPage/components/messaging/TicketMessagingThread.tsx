import { useEffect, useRef, useState } from 'react';
import { useTicketComments } from '@/hooks/useTicketComments';
import { useTicketUnreadCount } from '@/hooks/useTicketMessages';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import { Button } from '@/components/atoms/Button';
import { IconChat } from '../messagingIcons';
import { MessageItem } from './MessageItem';
import { NoteComposer } from './NoteComposer';
import { PublicReplyComposer } from './PublicReplyComposer';
import type { TicketComment, TicketCommentAttachment } from '@/types/ticketComments';
import type { AuthUser } from '@/types/auth';
import styles from './TicketMessagingThread.module.css';

interface Props {
  ticketId: string;
  /** #77 — metadata del ticket para el mensaje sintético de apertura. */
  description?: string;
  reporterName?: string | null;
  createdAt?: string;
}

function resolveAuthorName(user: AuthUser | null): string | null {
  if (!user) return null;
  const candidates = [user.displayName, user.username, user.email];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return null;
}

/**
 * TicketMessagingThread — ticket-messaging-ui. Reemplaza a
 * `TicketCommentsTimeline` (que solo cubría notas internas, pre-mensajería):
 * pinta el hilo MERGEADO (mensajes del cliente + respuestas públicas del
 * staff + notas internas — misma lista, `GET /:ticketId/comments`, el BE ya
 * los devuelve todos juntos) con 3 lanes visuales distintas, y monta las DOS
 * acciones de escritura como formularios SEPARADOS (`PublicReplyComposer` /
 * `NoteComposer`) — nunca un toggle/checkbox/dropdown que decida
 * visibilidad. Cada composer llama a su propia ruta/mutación; la visibilidad
 * la determina la ruta, no un campo que este componente pudiera mezclar.
 */
export function TicketMessagingThread({ ticketId, description, reporterName, createdAt }: Props) {
  const { data: comments, isLoading, isError, refetch } = useTicketComments(ticketId);
  const { data: unreadCount } = useTicketUnreadCount(ticketId);
  const { user } = useAuth();
  const canWrite = useCan('tickets.write');
  const authorName = resolveAuthorName(user);

  // #77 (migrado) — mensaje sintético de apertura, derivado del ticket (no
  // persistido). Lane 'client': es el reclamo original del reporter, la
  // misma semántica que un mensaje público del cliente.
  const openingComment: TicketComment | null = description?.trim()
    ? {
        id: `initial-${ticketId}`,
        ticketId,
        authorName: reporterName ?? 'Sistema',
        body: description,
        createdAt: createdAt ?? '',
        attachments: [] as TicketCommentAttachment[],
        visibility: 'public',
        authorKind: 'client',
      }
    : null;

  // M5 (fix wave) — filas efectivamente renderizadas (apertura + comentarios),
  // en el mismo orden que el JSX de abajo. Se usa para el guard de
  // auto-scroll: necesita saber cuál es la ÚLTIMA fila (¿la mandó el staff?)
  // y un key estable de "entró/salió una fila" sin reaccionar a cada
  // re-render.
  const allRows: TicketComment[] = openingComment ? [openingComment, ...(comments ?? [])] : (comments ?? []);
  const rowIdsKey = allRows.map((r) => r.id).join('|');

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // C1 (fix wave, CRITICAL) — defensa en profundidad: aunque `key={ticketId}`
  // en el caller ya fuerza un remount completo (por lo que este ref nace
  // vacío), resetear explícitamente acá evita que un futuro caller que NO
  // pase esa key deje `seenIdsRef` con los ids del ticket anterior — eso
  // animaría TODOS los mensajes del ticket nuevo como "recién llegados".
  useEffect(() => {
    seenIdsRef.current = new Set();
    setJustAddedIds(new Set());
  }, [ticketId]);

  useEffect(() => {
    if (!comments) return;
    const newOnes = new Set<string>();
    for (const c of comments) {
      if (!seenIdsRef.current.has(c.id)) {
        if (seenIdsRef.current.size > 0) newOnes.add(c.id);
        seenIdsRef.current.add(c.id);
      }
    }
    if (newOnes.size > 0) {
      setJustAddedIds(newOnes);
      const t = setTimeout(() => setJustAddedIds(new Set()), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [comments]);

  // M5 (fix wave) — auto-scroll al fondo. Mismo guard ya probado en
  // `MessageThread` (inbox de WhatsApp, bug #7 de ese review): SOLO
  // auto-scrollea cuando (a) el hilo se acaba de abrir/montar, (b) el
  // operador ya estaba cerca del fondo (no le arranca de las manos una
  // lectura de historial viejo), o (c) la última fila es un envío propio del
  // staff (la razón por la que escribió es verlo salir). `NEAR_BOTTOM_PX`
  // mismo valor (120px) que la versión ya reafirmada en WhatsApp.
  const NEAR_BOTTOM_PX = 120;
  const isFirstScrollRunRef = useRef(true);
  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const isFirstRun = isFirstScrollRunRef.current;
    isFirstScrollRunRef.current = false;

    const lastRow = allRows[allRows.length - 1];
    const isOwnStaffSend = lastRow?.authorKind === 'staff';

    const list = listRef.current;
    const isNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;

    if (isFirstRun || isOwnStaffSend || isNearBottom) {
      bottom.scrollIntoView?.({ block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-correr cuando cambia el SET de filas (rowIdsKey), no en cada re-render.
  }, [rowIdsKey]);

  const hasUnread = unreadCount != null && unreadCount > 0;

  return (
    <section className={styles.section} aria-labelledby="ticket-messaging-heading">
      <header className={styles.header}>
        <h2 id="ticket-messaging-heading" className={styles.sectionTitle}>
          <IconChat className={styles.headingIcon} />
          Conversación
        </h2>
        {hasUnread && (
          <span className={styles.unreadBadge} role="status" aria-live="polite">
            {unreadCount} sin leer
          </span>
        )}
      </header>

      {isLoading && (
        <div data-testid="messaging-thread-skeleton" className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonRow} />
          <div className={[styles.skeletonRow, styles.skeletonRowShort].join(' ')} />
          <div className={styles.skeletonRow} />
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar los mensajes.</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && comments && comments.length === 0 && !openingComment && (
        <div className={styles.emptyState}>
          <p>Sin mensajes todavía.</p>
        </div>
      )}

      {!isLoading && !isError && comments && (comments.length > 0 || openingComment) && (
        // M5 (fix wave) — ref (auto-scroll), data-testid (mide scrollHeight/
        // scrollTop en test) y aria-live="polite" (un mensaje nuevo se
        // anuncia, mismo criterio que `MessageThread` del inbox de WhatsApp).
        <div
          ref={listRef}
          data-testid="messaging-thread-list"
          className={styles.timeline}
          role="list"
          aria-label="Mensajes del ticket"
          aria-live="polite"
        >
          {openingComment && <MessageItem comment={openingComment} isNew={false} />}
          {comments.map((comment) => (
            <MessageItem key={comment.id} comment={comment} isNew={justAddedIds.has(comment.id)} />
          ))}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      )}

      {canWrite && (
        <div className={styles.composers}>
          {/* C1 (fix wave, CRITICAL) — key={ticketId} en AMBOS composers,
              defensa en profundidad además del key en TicketTabs: si este
              componente alguna vez se usa sin esa key exterior (o el árbol
              cambia), el draft/adjuntos NO deben poder viajar de un ticket a
              otro. */}
          <PublicReplyComposer key={ticketId} ticketId={ticketId} authorName={authorName} />
          <NoteComposer key={ticketId} ticketId={ticketId} authorName={authorName} />
        </div>
      )}
    </section>
  );
}
