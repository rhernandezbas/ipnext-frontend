import { Button } from '@/components/atoms/Button/Button';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { CONVERSATION_STATUS_VARIANT, CONVERSATION_STATUS_LABEL, nextConversationStatus } from './conversationStatus';
import { IconCheck, IconRotateCcw } from './statusIcons';
import type { WhatsappConversationStatus } from '@/types/whatsapp';
import styles from './ConversationStatusToggle.module.css';

interface ConversationStatusToggleProps {
  /**
   * `null` cuando el detalle todavía no cargó (mismo criterio que `onBack`/
   * `contactName` en `MessageThread`) — no se renderiza nada, nada que
   * resolver/reabrir todavía.
   */
  status: WhatsappConversationStatus | string | null;
  /** Recibe el status DESTINO ya calculado (v1: siempre 'open' o 'resolved') — el padre solo reenvía a `useSetConversationStatus(id).setStatus`. */
  onToggle: (next: WhatsappConversationStatus) => void;
  isPending?: boolean;
}

const WINDOW_HINT_ID = 'conversation-status-hint';
const WINDOW_HINT_TEXT =
  'No afecta la ventana de 24 horas de WhatsApp: podés responder o dejar de poder hacerlo sin importar si la conversación está resuelta o abierta.';

/**
 * ConversationStatusToggle — botón Resolver/Reabrir + badge de estado del
 * thread (messaging-inbox-productivity F1.5-C v1 — RESOLVER/REABRIR).
 * Reusa `StatusBadge` (atom existente) y `Button` (atom existente, ya trae
 * disabled+spinner via `loading`) — cero hex/token/componente nuevo para el
 * estado de carga. `key={status}` en el wrapper del badge fuerza un remount
 * corto (crossfade+scale, `ConversationStatusToggle.module.css`) cada vez
 * que el status cambia — "state indication" (Emil §2), NUNCA en acciones de
 * teclado repetitivas.
 */
export function ConversationStatusToggle({ status, onToggle, isPending = false }: ConversationStatusToggleProps) {
  if (status === null) return null;

  const isResolved = status === 'resolved';
  const variant = CONVERSATION_STATUS_VARIANT[status] ?? 'inactive';
  const label = CONVERSATION_STATUS_LABEL[status] ?? status;
  const next = nextConversationStatus(status);
  const actionLabel = isResolved ? 'Reabrir' : 'Resolver';

  return (
    <div className={styles.wrapper}>
      <span key={status} className={styles.badgeWrap}>
        <StatusBadge status={variant} label={label} />
      </span>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={isPending}
        onClick={() => onToggle(next)}
        aria-label={`${actionLabel} conversación`}
        aria-describedby={WINDOW_HINT_ID}
      >
        {isResolved ? <IconRotateCcw className={styles.icon} /> : <IconCheck className={styles.icon} />}
        {actionLabel}
      </Button>

      <span id={WINDOW_HINT_ID} className={styles.srOnly}>
        {WINDOW_HINT_TEXT}
      </span>
    </div>
  );
}
