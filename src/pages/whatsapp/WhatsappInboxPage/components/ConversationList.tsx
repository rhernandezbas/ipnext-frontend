import { useMemo, useState } from 'react';
import { Input } from '@/components/atoms/Input/Input';
import { ConversationListItem } from './ConversationListItem';
import { ConversationAssignmentFilter } from './ConversationAssignmentFilter';
import { Skeleton } from './Skeleton';
import type { ConversationAssignment, WhatsappConversationListItem } from '@/types/whatsapp';
import styles from './ConversationList.module.css';

interface ConversationListProps {
  conversations: WhatsappConversationListItem[];
  isLoading: boolean;
  isError?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * messaging-inbox-assignment F1.5-C2 — filtro de asignación SERVER-SIDE
   * (`WhatsappInboxPage` orquesta `useWhatsappConversations` con este valor en
   * el `query`, design contrato). Opcionales con default 'all'/no-op para no
   * romper los call sites/tests previos a esta tanda (que no lo pasan).
   */
  assignment?: ConversationAssignment;
  onAssignmentChange?: (next: ConversationAssignment) => void;
}

const SKELETON_ROWS = 5;

function matchesSearch(conv: WhatsappConversationListItem, term: string): boolean {
  if (!term) return true;
  const haystack = `${conv.contactName ?? ''} ${conv.contactPhone ?? ''} ${conv.preview ?? ''}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function timeValue(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * ConversationList — panel izquierdo del inbox (messaging-inbox F1, design
 * §1/§2, LIST-1). Presentacional: recibe la data ya fetcheada por
 * `WhatsappInboxPage` (que orquesta `useWhatsappConversations`, design §1) vía
 * props — acá solo se resuelven dos concerns puramente de UI que NO viven en
 * el contrato del BE (design §3): orden por `lastMessageAt` desc (el DTO no
 * garantiza orden) y el filtro de búsqueda client-side (sin `search` param en
 * `WhatsappPaginatedQuery`).
 */
export function ConversationList({
  conversations,
  isLoading,
  isError = false,
  selectedId,
  onSelect,
  assignment = 'all',
  onAssignmentChange = () => {},
}: ConversationListProps) {
  const [search, setSearch] = useState('');

  const visible = useMemo(
    () =>
      conversations
        .filter((c) => matchesSearch(c, search))
        .slice()
        .sort((a, b) => timeValue(b.lastMessageAt) - timeValue(a.lastMessageAt)),
    [conversations, search],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.filterWrapper}>
        <ConversationAssignmentFilter value={assignment} onChange={onAssignmentChange} />
      </div>

      <div className={styles.searchWrapper}>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar conversaciones"
        />
      </div>

      {isLoading && (
        <div className={styles.skeletonList}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton circle width={36} height={36} />
              <div className={styles.skeletonLines}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="90%" height={10} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className={styles.errorState} role="alert">
          No se pudieron cargar las conversaciones.
        </p>
      )}

      {!isLoading && !isError && conversations.length === 0 && (
        <p className={styles.emptyState}>No hay conversaciones.</p>
      )}

      {!isLoading && !isError && conversations.length > 0 && visible.length === 0 && (
        <p className={styles.emptyState}>No se encontraron conversaciones para “{search}”.</p>
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <ul className={styles.list} role="list" aria-label="Conversaciones">
          {visible.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={conv.id === selectedId}
              onClick={() => onSelect(conv.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
