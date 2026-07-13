import { formatTimeShort } from '@/utils/formatDate';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { CONVERSATION_STATUS_VARIANT, CONVERSATION_STATUS_LABEL } from './conversationStatus';
import type { WhatsappConversationListItem } from '@/types/whatsapp';
import styles from './ConversationListItem.module.css';

interface ConversationListItemProps {
  conversation: WhatsappConversationListItem;
  selected: boolean;
  onClick: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

/**
 * ConversationListItem — fila de la lista de conversaciones (messaging-inbox
 * F1, design §1/§3, LIST-1 escenario "preview+contacto+estado", A11Y-1).
 * Presentacional: recibe el DTO ya resuelto, `onClick` sin argumentos (el
 * padre, `ConversationList` FB3, cierra sobre `conversation.id`).
 */
export function ConversationListItem({ conversation, selected, onClick }: ConversationListItemProps) {
  const displayName = conversation.contactName?.trim() || conversation.contactPhone || 'Contacto sin nombre';
  const preview = conversation.preview?.trim() || 'Sin mensajes';
  const time = formatTimeShort(conversation.lastMessageAt);
  const variant = CONVERSATION_STATUS_VARIANT[conversation.status] ?? 'inactive';
  const label = CONVERSATION_STATUS_LABEL[conversation.status] ?? conversation.status;

  return (
    <li className={styles.item}>
      <button
        type="button"
        className={[styles.button, selected ? styles.selected : ''].filter(Boolean).join(' ')}
        onClick={onClick}
        aria-current={selected ? 'true' : undefined}
        aria-label={`Conversación con ${displayName}, estado ${label}`}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(displayName)}
        </span>

        <span className={styles.main}>
          <span className={styles.topRow}>
            <span className={styles.name}>{displayName}</span>
            <time className={styles.time} dateTime={conversation.lastMessageAt ?? undefined}>
              {time}
            </time>
          </span>

          <span className={styles.bottomRow}>
            <span className={styles.preview}>{preview}</span>
            <StatusBadge status={variant} label={label} />
          </span>
        </span>
      </button>
    </li>
  );
}
