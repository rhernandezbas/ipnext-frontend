import { useEffect, useRef, useState } from 'react';
import { formatTimeShort } from '@/utils/formatDate';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { MediaAttachments } from './MediaAttachments';
import { IconAlert, IconNote, IconTrash } from './mediaIcons';
import type { WhatsappMessage } from '@/types/whatsapp';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: WhatsappMessage;
  /**
   * True when this bubble just arrived via polling (THREAD-1) and should play
   * the entrance motion (design §7). Defaults to false — the initial thread
   * load renders history WITHOUT animating every bubble (see AUDIT.md §1:
   * animating a full initial list has no purpose and reads as noise). The
   * parent (`MessageThread`, FB3) is responsible for flagging only the truly
   * new message(s) after a poll, the same `isNew`-then-clear-after-timeout
   * pattern used by `TicketCommentsTimeline`'s `justAddedIds`.
   */
  isNew?: boolean;
  /**
   * 0-based position among bubbles that arrived together in the same poll.
   * Only meaningful when `isNew` — multiplies into a 40ms stagger (design §7)
   * so simultaneous arrivals cascade instead of popping in at once.
   */
  staggerIndex?: number;
  /**
   * Fix bug CRÍTICO #1 (post-review-adversarial): threadeado desde
   * `WhatsappInboxPage` (único lugar con `queryClient`+`conversationId`) vía
   * `MessageThread`, hasta `MediaAttachments`→`MediaAttachment`→`MediaError`.
   * Sin esto, "Reintentar" en un adjunto `failed` era un control muerto.
   */
  onRetryAttachment?: () => void;
  /**
   * Estado de ENTREGA del envío optimista (messaging-inbox-v2-media F1.5
   * fase A, Tanda 2, design §5.3) — TODOS opcionales → cero regresión
   * inbound/outbound-confirmado (mensajes reales del server nunca los
   * reciben). `undefined` = sin overlay, comportamiento actual intacto.
   */
  deliveryStatus?: 'sending' | 'failed';
  /** 0..1, solo relevante con `deliveryStatus==='sending'`. */
  uploadProgress?: number;
  /** solo con `deliveryStatus==='failed'`. */
  onRetry?: () => void;
  /** solo con `deliveryStatus==='failed'`. */
  onDiscard?: () => void;
  /**
   * internal-notes F1.5 (EDITAR/ELIMINAR NOTA) — callbacks threadeados desde
   * `WhatsappInboxPage` (único lugar con `queryClient`+`conversationId`) vía
   * `MessageThread` (mismo criterio que `onRetryAttachment`, presentacional
   * puro). Las acciones SOLO se muestran sobre notas (`private:true`) NO
   * borradas, y sólo la acción cuyo flag (`message.canEdit`/`.canDelete`,
   * resueltos por el BE) sea `true`. Ausentes → cero acciones (call sites
   * previos a esta tanda no cambian).
   */
  onEditNote?: (messageId: string, content: string) => void;
  onDeleteNote?: (messageId: string) => void;
}

const STAGGER_MS = 40;

/**
 * Bug #13 (post-review-adversarial, review-animations de Emil): bajo
 * `prefers-reduced-motion`, `.row.enter` cambia a `waBubbleEnterReduced`
 * (200ms, sin `translateY`) — pero el `animationDelay` inline seguía
 * aplicándose igual, así que un batch de burbujas nuevas (ej. últimas de un
 * poll grande) quedaba invisible hasta ~800ms bajo `fill-mode:both`, exactamente
 * lo que reduced-motion busca evitar. jsdom NO implementa `matchMedia` (queda
 * `undefined`) — el guard de tipo/try-catch evita romper en ese entorno.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const PROGRESS_MILESTONES = [0.25, 0.5, 0.75] as const;

/**
 * useProgressAnnouncement (bug MEDIO #11, post-review-adversarial) — el
 * `role=progressbar` ya tiene un `aria-label` estático ("Enviando archivo"),
 * pero un lector de pantalla no re-anuncia `aria-valuenow` en cada tick por
 * su cuenta — sin una región `aria-live` dedicada, el agente ciego no se
 * entera del avance salvo que vuelva a enfocar la barra. Narra SOLO al
 * cruzar un hito (25/50/75/100%) o al fallar — nunca en cada tick (eso
 * saturaría el lector, ver también el throttle de progreso en
 * `useWhatsapp.ts`, bug #11 hermano).
 */
function useProgressAnnouncement(deliveryStatus: 'sending' | 'failed' | undefined, uploadProgress: number): string {
  const [announcement, setAnnouncement] = useState('');
  const lastMilestoneRef = useRef(-1);

  useEffect(() => {
    if (deliveryStatus === 'failed') {
      lastMilestoneRef.current = -1;
      setAnnouncement('Error al enviar el archivo');
      return;
    }
    if (deliveryStatus !== 'sending') return;

    if (uploadProgress >= 1) {
      setAnnouncement('Archivo enviado');
      return;
    }

    const idx = PROGRESS_MILESTONES.filter((m) => uploadProgress >= m).length - 1;
    if (idx >= 0 && idx !== lastMilestoneRef.current) {
      lastMilestoneRef.current = idx;
      setAnnouncement(`${Math.round(PROGRESS_MILESTONES[idx]! * 100)}% enviado`);
    }
  }, [deliveryStatus, uploadProgress]);

  return announcement;
}

/**
 * MessageBubble — burbuja inbound/outbound del thread (messaging-inbox F1,
 * design §1/§3/§7, THREAD-1). Puramente presentacional: recibe el mensaje ya
 * resuelto, sin data-fetching ni lógica de negocio.
 */
export function MessageBubble({
  message,
  isNew = false,
  staggerIndex = 0,
  onRetryAttachment,
  deliveryStatus,
  uploadProgress = 0,
  onRetry,
  onDiscard,
  onEditNote,
  onDeleteNote,
}: MessageBubbleProps) {
  // messaging-inbox-notes F1.5 fase D (design §4.1) — la nota IGNORA
  // `direction` por completo: ni inbound ni outbound, es una 3ra rama visual
  // (ancho completo, sin alineación izq/der — patrón Chatwoot).
  const rowClassName = [
    styles.row,
    message.private ? styles.note : styles[message.direction],
    isNew ? styles.enter : '',
  ]
    .filter(Boolean)
    .join(' ');

  // internal-notes F1.5 — flags derivados. Una nota borrada (TOMBSTONE) es un
  // callejón sin salida: no se edita ni se re-borra. Las acciones dependen del
  // permiso YA resuelto por el BE (`message.canEdit`/`.canDelete`) Y de que el
  // caller haya threadeado el callback (presentacional: sin wiring, sin acción).
  const isNote = message.private === true;
  const isDeleted = message.deleted === true;
  const canEditNote = isNote && !isDeleted && message.canEdit === true && !!onEditNote;
  const canDeleteNote = isNote && !isDeleted && message.canDelete === true && !!onDeleteNote;

  // Estado local SÓLO de VISTA (isEditing/draft/confirm) — no es lógica de
  // negocio (esa vive en el hook/página): la mutación real la dispara el
  // callback. Mismo criterio que el `open` local de `KebabMenu`.
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function startEdit() {
    setDraft(message.content);
    setIsEditing(true);
  }
  function cancelEdit() {
    setDraft(message.content);
    setIsEditing(false);
  }
  function saveEdit() {
    const next = draft.trim();
    if (next === '') return; // el BE exige content no vacío — Guardar ya está disabled, doble cinturón
    onEditNote?.(message.id, next);
    setIsEditing(false);
  }

  const applyStaggerDelay = isNew && !prefersReducedMotion();
  const progressAnnouncement = useProgressAnnouncement(deliveryStatus, uploadProgress);

  // design §5.3: la burbuja "en vuelo" baja a opacity 0.85 (indica "aún no
  // confirmado" — Emil *state indication*); `failed` vuelve a opacity plena
  // (el énfasis pasa al aviso de error, no a "atenuar" el mensaje).
  const bubbleClassName = [styles.bubble, deliveryStatus === 'sending' ? styles.sending : '']
    .filter(Boolean)
    .join(' ');

  // internal-notes F1.5 — TOMBSTONE: una nota borrada NO desaparece del hilo
  // (el BE la sigue devolviendo con `deleted:true`+`content:""`). Rama visual
  // "apagada": ícono + "Nota eliminada", sin content, sender, acciones ni
  // overlays de envío (una nota borrada nunca está "en vuelo"). El texto es el
  // nombre accesible (legible por SR); el ícono va aria-hidden.
  if (isDeleted) {
    return (
      <div
        data-testid="message-bubble-row"
        className={[rowClassName, styles.tombstoneRow].filter(Boolean).join(' ')}
        style={applyStaggerDelay ? { animationDelay: `${staggerIndex * STAGGER_MS}ms` } : undefined}
      >
        <div className={[styles.bubble, styles.tombstone].join(' ')} data-testid="note-tombstone">
          <IconTrash className={styles.tombstoneIcon} />
          <span>Nota eliminada</span>
          <time className={styles.time} dateTime={message.sentAt}>
            {formatTimeShort(message.sentAt)}
          </time>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="message-bubble-row"
      className={rowClassName}
      style={applyStaggerDelay ? { animationDelay: `${staggerIndex * STAGGER_MS}ms` } : undefined}
    >
      <div className={bubbleClassName}>
        {/* design §4.3 — indicador NO-color (a11y): el fill amber solo casi
            no se distingue de la página (1.11:1), así que el label+ícono son
            OBLIGATORIOS, no decorativos. El label es el nombre accesible que
            el lector anuncia ANTES del contenido: "Nota interna, {sender},
            {content}".
            internal-notes F1.5 — el header ahora aloja también las acciones
            Editar/Eliminar (a la derecha, `margin-left:auto`), reveladas en
            hover/focus-within (CSS) pero SIEMPRE en el DOM (alcanzables por
            teclado y lector — el CSS es progressive enhancement). */}
        {isNote && (
          <div className={styles.noteHeader}>
            <IconNote className={styles.noteIcon} />
            <span>Nota interna</span>
            {!isEditing && (canEditNote || canDeleteNote) && (
              <div className={styles.noteActions}>
                {canEditNote && (
                  <button
                    type="button"
                    className={styles.noteActionButton}
                    onClick={startEdit}
                    aria-label="Editar nota"
                  >
                    <IconNote className={styles.noteActionIcon} />
                  </button>
                )}
                {canDeleteNote && (
                  <button
                    type="button"
                    className={styles.noteActionButton}
                    onClick={() => setConfirmOpen(true)}
                    aria-label="Eliminar nota"
                  >
                    <IconTrash className={styles.noteActionIcon} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {message.senderName && !isEditing && (
          <span data-testid="message-bubble-sender" className={styles.sender}>
            {message.senderName}
          </span>
        )}

        {/* internal-notes F1.5 — edición INLINE (patrón Chatwoot): el textarea
            reemplaza el content de sólo-lectura. Guardar disabled si queda
            vacío (el BE exige content no vacío). */}
        {isEditing ? (
          <div className={styles.editForm}>
            <textarea
              className={styles.editTextarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Editar nota interna"
              rows={2}
            />
            <div className={styles.editActions}>
              <button type="button" className={styles.editCancel} onClick={cancelEdit}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.editSave}
                onClick={saveEdit}
                disabled={draft.trim() === ''}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          message.content.trim() !== '' && (
            <span data-testid="message-bubble-content">{message.content}</span>
          )
        )}

        {message.attachments && message.attachments.length > 0 && !isEditing && (
          <MediaAttachments attachments={message.attachments} onRetryAttachment={onRetryAttachment} />
        )}

        {(deliveryStatus === 'sending' || deliveryStatus === 'failed') && progressAnnouncement && (
          <span className={styles.srOnly} role="status" aria-live="polite">
            {progressAnnouncement}
          </span>
        )}

        {deliveryStatus === 'sending' && (
          <div
            className={styles.deliveryProgress}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(uploadProgress * 100)}
            aria-label="Enviando archivo"
          >
            <div className={styles.deliveryProgressFill} style={{ transform: `scaleX(${uploadProgress})` }} />
          </div>
        )}

        {deliveryStatus === 'failed' && (
          <div className={styles.deliveryFailed} role="alert">
            <IconAlert className={styles.deliveryFailedIcon} />
            <span>No se pudo enviar</span>
            <button type="button" className={styles.deliveryRetryBtn} onClick={onRetry}>
              Reintentar
            </button>
            <button type="button" className={styles.deliveryDiscardBtn} onClick={onDiscard}>
              Descartar
            </button>
          </div>
        )}

        <time className={styles.time} dateTime={message.sentAt}>
          {formatTimeShort(message.sentAt)}
          {/* internal-notes F1.5 — marca "(editado)" (nunca en el tombstone,
              que retorna antes). Estilo `--wa-*` con opacity, mismo de-énfasis
              que el timestamp. */}
          {message.edited === true && <span className={styles.editedTag}> (editado)</span>}
        </time>
      </div>

      {/* internal-notes F1.5 — confirm SUAVE de borrado. Se reusa el
          `ConfirmModal` del repo (focus-trap + Esc + tono danger + foco
          inicial en Cancelar) en vez de reinventar un diálogo. Portalea a
          `document.body`, así el lugar del render no afecta el layout. El
          confirm ("Eliminar") tiene un nombre accesible DISTINTO de la acción
          de la burbuja ("Eliminar nota") — no colisionan. */}
      {canDeleteNote && (
        <ConfirmModal
          open={confirmOpen}
          title="Eliminar nota interna"
          message="¿Eliminar esta nota? No se puede deshacer."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          tone="danger"
          onConfirm={() => {
            onDeleteNote?.(message.id);
            setConfirmOpen(false);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
