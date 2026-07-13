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

          {/*
           * messaging-inbox-assignment F1.5-C2 — 3ra fila, condicional (solo
           * ocupa espacio cuando hay algo que mostrar): nombre del agente
           * asignado + chip del área.
           *
           * hallazgo MEDIUM #3 (review adversarial): la versión anterior
           * usaba el hex del área como FONDO del texto (+ `readableTextColor`
           * encima, mismo criterio que `AreaPill` de Tickets,
           * `TicketsTableView.tsx`) — pero para hexes muy SATURADOS (ej. rojo
           * puro) ninguna opción de texto (blanco/casi-negro) llega a 4.5:1
           * de contraste real; el umbral de luminancia de `readableTextColor`
           * no lo captura. Fix: el color del área es SOLO un acento (un dot,
           * `.areaDot`, `aria-hidden` — es puramente decorativo, el nombre YA
           * es el texto accesible), el NOMBRE va en `.areaName`, que usa el
           * color de texto SEGURO del theme (`var(--color-text-secondary)`,
           * CSS module, mismo que `.assigneeName`) — así CUALQUIER hex del
           * catálogo es legal, sin depender de heurísticas de contraste.
           *
           * hallazgo MEDIUM #4: `.areaName` tiene `max-width` +
           * `overflow:hidden` + `text-overflow:ellipsis` + `min-width:0`
           * (`ConversationListItem.module.css`) para que un nombre de área
           * largo NO empuje el layout de la fila — mismo criterio que ya
           * aplica `.assigneeName`.
           */}
          {(conversation.assignee || conversation.area) && (
            <span className={styles.metaRow}>
              {conversation.assignee && (
                <span className={styles.assigneeName}>{conversation.assignee.name}</span>
              )}
              {conversation.area && (
                <span className={styles.areaChip}>
                  <span
                    className={styles.areaDot}
                    style={{ backgroundColor: conversation.area.color }}
                    aria-hidden="true"
                    data-testid="area-dot"
                  />
                  <span className={styles.areaName}>{conversation.area.name}</span>
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
