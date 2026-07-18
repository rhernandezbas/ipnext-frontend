import { useState } from 'react';
import { usePreviousConversations } from '@/hooks/useWhatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { readableTextColor } from '@/utils/contrastColor';
import { formatDateShort } from '@/utils/formatDate';
import { CONVERSATION_STATUS_VARIANT, CONVERSATION_STATUS_LABEL } from '../conversationStatus';
import styles from './PreviousConversationsSection.module.css';

interface PreviousConversationsSectionProps {
  /** Conversación abierta — el endpoint devuelve las OTRAS del mismo contacto. */
  conversationId: string;
  /** Saltar a otra conversación (la page hace `setSelectedId`). */
  onNavigate: (id: string) => void;
}

const PANEL_ID = 'wa-previous-conversations';

function IconChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={[styles.chevron, expanded ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * PreviousConversationsSection (Ola 6 — conversaciones previas) — sección
 * COLAPSABLE del panel de contexto que lista OTRAS conversaciones del mismo
 * contacto (`GET /conversations/:id/previous`). FETCH-ON-EXPAND: el hook
 * (`usePreviousConversations`) se pasa `enabled={expanded}`, así el endpoint
 * SOLO se pega al desplegar (mismo criterio lazy que el picker de templates /
 * respuestas rápidas). 4 ramas: cargando / error+reintentar / vacío / lista.
 * Cada previa es clickeable → salta a esa conversación (`onNavigate`, que la
 * page mapea a `setSelectedId`).
 *
 * Se remonta por conversación (el panel lleva `key={selectedId}`), así que
 * `expanded` vuelve a colapsado y no arrastra datos de otro contacto (lección
 * `inbox-key-por-conversacion`).
 */
export function PreviousConversationsSection({ conversationId, onNavigate }: PreviousConversationsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const query = usePreviousConversations(conversationId, expanded);
  const items = query.data ?? [];

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={expanded}
        aria-controls={PANEL_ID}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={styles.headerTitle}>Conversaciones previas</span>
        <IconChevron expanded={expanded} />
      </button>

      {expanded && (
        <div id={PANEL_ID} className={styles.body}>
          {query.isLoading ? (
            <p className={styles.notice} role="status">
              Cargando conversaciones…
            </p>
          ) : query.isError && !query.data ? (
            <div className={styles.errorBox}>
              <p className={styles.error} role="alert">
                No se pudieron cargar las conversaciones previas.
              </p>
              <button type="button" className={styles.retryBtn} onClick={() => void query.refetch()}>
                Reintentar
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className={styles.empty}>No hay otras conversaciones de este contacto.</p>
          ) : (
            <ul className={styles.list} role="list">
              {items.map((c) => {
                const variant = CONVERSATION_STATUS_VARIANT[c.status] ?? 'inactive';
                const statusLabel = CONVERSATION_STATUS_LABEL[c.status] ?? c.status;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => onNavigate(c.id)}
                      aria-label={`Ir a la conversación ${statusLabel}${c.unread ? ', con mensajes sin leer' : ''}`}
                    >
                      <div className={styles.itemHead}>
                        <StatusBadge status={variant} label={statusLabel} />
                        {c.unread && <span className={styles.unreadDot} aria-hidden="true" />}
                        <span className={styles.itemDate}>{formatDateShort(c.lastMessageAt)}</span>
                      </div>
                      {c.lastMessagePreview && <p className={styles.itemPreview}>{c.lastMessagePreview}</p>}
                      {c.labels.length > 0 && (
                        <div className={styles.itemLabels}>
                          {c.labels.map((label) => (
                            <span
                              key={label.id}
                              className={styles.labelChip}
                              style={{ background: label.color, color: readableTextColor(label.color) }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.assigneeName && <span className={styles.itemAssignee}>{c.assigneeName}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
