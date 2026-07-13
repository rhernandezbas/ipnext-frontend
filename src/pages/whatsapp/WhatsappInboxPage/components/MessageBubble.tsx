import { useEffect, useRef, useState } from 'react';
import { formatTimeShort } from '@/utils/formatDate';
import { MediaAttachments } from './MediaAttachments';
import { IconAlert } from './mediaIcons';
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
}: MessageBubbleProps) {
  const rowClassName = [
    styles.row,
    styles[message.direction],
    isNew ? styles.enter : '',
  ]
    .filter(Boolean)
    .join(' ');

  const applyStaggerDelay = isNew && !prefersReducedMotion();
  const progressAnnouncement = useProgressAnnouncement(deliveryStatus, uploadProgress);

  // design §5.3: la burbuja "en vuelo" baja a opacity 0.85 (indica "aún no
  // confirmado" — Emil *state indication*); `failed` vuelve a opacity plena
  // (el énfasis pasa al aviso de error, no a "atenuar" el mensaje).
  const bubbleClassName = [styles.bubble, deliveryStatus === 'sending' ? styles.sending : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-testid="message-bubble-row"
      className={rowClassName}
      style={applyStaggerDelay ? { animationDelay: `${staggerIndex * STAGGER_MS}ms` } : undefined}
    >
      <div className={bubbleClassName}>
        {message.senderName && (
          <span data-testid="message-bubble-sender" className={styles.sender}>
            {message.senderName}
          </span>
        )}
        {message.content.trim() !== '' && (
          <span data-testid="message-bubble-content">{message.content}</span>
        )}
        {message.attachments && message.attachments.length > 0 && (
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
        </time>
      </div>
    </div>
  );
}
