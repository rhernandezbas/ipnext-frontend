import { formatTimeShort } from '@/utils/formatDate';
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

/**
 * MessageBubble — burbuja inbound/outbound del thread (messaging-inbox F1,
 * design §1/§3/§7, THREAD-1). Puramente presentacional: recibe el mensaje ya
 * resuelto, sin data-fetching ni lógica de negocio.
 */
export function MessageBubble({ message, isNew = false, staggerIndex = 0 }: MessageBubbleProps) {
  const rowClassName = [
    styles.row,
    styles[message.direction],
    isNew ? styles.enter : '',
  ]
    .filter(Boolean)
    .join(' ');

  const applyStaggerDelay = isNew && !prefersReducedMotion();

  return (
    <div
      data-testid="message-bubble-row"
      className={rowClassName}
      style={applyStaggerDelay ? { animationDelay: `${staggerIndex * STAGGER_MS}ms` } : undefined}
    >
      <div className={styles.bubble}>
        {message.senderName && (
          <span data-testid="message-bubble-sender" className={styles.sender}>
            {message.senderName}
          </span>
        )}
        <span>{message.content}</span>
        <time className={styles.time} dateTime={message.sentAt}>
          {formatTimeShort(message.sentAt)}
        </time>
      </div>
    </div>
  );
}
