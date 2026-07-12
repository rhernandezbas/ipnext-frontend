import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useWhatsappConversations,
  useWhatsappConversation,
  useWhatsappMessages,
  whatsappMessagesKey,
} from '@/hooks/useWhatsapp';
import { ConversationList } from './WhatsappInboxPage/components/ConversationList';
import { MessageThread } from './WhatsappInboxPage/components/MessageThread';
import { ClientContextPanel } from './WhatsappInboxPage/components/ClientContextPanel';
import { Composer } from './WhatsappInboxPage/components/Composer';
import type { WhatsappPaginatedQuery } from '@/types/whatsapp';
import styles from './WhatsappInboxPage.module.css';

/**
 * WhatsappInboxPage — container del inbox WhatsApp (messaging-inbox F1,
 * design §1/§2/§4, FB4). Orquesta los 4 hooks de `useWhatsapp.ts` (FB1) y
 * compone los 4 paneles presentacionales (FB2/FB3) vía props — este archivo
 * NO tiene lógica de negocio propia, solo wiring + el layout 3-paneles
 * full-height (`WhatsappInboxPage.module.css`, primer opt-out local del
 * padding de `AdminLayout` en el repo).
 *
 * `selectedId` es estado LOCAL (design §4, LIST-1): vive acá, no en la query
 * de conversaciones — el polling de `useWhatsappConversations` reemplaza el
 * array completo en cada refetch pero NUNCA toca este estado, así que la
 * selección sobrevive al polling sin lógica extra.
 *
 * `query` (WhatsappPaginatedQuery — page/limit del contrato BE, design §3)
 * es TAMBIÉN estado local, aunque F1 no expone controles de paginación
 * todavía: mantenerlo en `useState` (en vez de un objeto literal inline en
 * cada render) le da identidad estable a través de renders, evitando
 * recomputar la queryKey de `useWhatsappConversations` sin necesidad. El
 * texto de búsqueda NO vive acá — es estado propio de `ConversationList`
 * (FB3, filtro client-side; `WhatsappPaginatedQuery` no tiene `search`).
 */
export default function WhatsappInboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query] = useState<WhatsappPaginatedQuery>({});
  const queryClient = useQueryClient();

  const conversationsQuery = useWhatsappConversations(query);
  const detailQuery = useWhatsappConversation(selectedId ?? '');
  const messagesQuery = useWhatsappMessages(selectedId ?? '');

  /**
   * Fix bug CRÍTICO #1 (post-review-adversarial, 2 reviewers): "Reintentar"
   * en un adjunto `failed` (`MediaError`) no re-dispara la descarga (eso lo
   * hace el scheduler del BE, design §3.6) — fuerza un re-check invalidando
   * la query de mensajes del thread abierto, que dispara un refetch real. Si
   * el scheduler ya lo bajó, el próximo render lo muestra `downloaded`.
   */
  function handleRetryAttachment() {
    if (!selectedId) return;
    void queryClient.invalidateQueries({ queryKey: whatsappMessagesKey(selectedId) });
  }

  const conversations = conversationsQuery.data?.data ?? [];
  const messages = messagesQuery.data ?? [];
  const detail = detailQuery.data;

  // Bug #12 (post-review-adversarial, polish): mientras `detail` todavía no
  // resolvió (fetch-on-open en vuelo), el header del thread mostraba el
  // fallback genérico "Contacto" — un flicker evitable, porque el
  // `contactName`/`contactPhone` del list-item YA están disponibles (vienen
  // de `useWhatsappConversations`, que se fetchea antes de cualquier
  // selección). Se usa como fallback SOLO mientras `detail` no trae el dato.
  const selectedListItem = conversations.find((c) => c.id === selectedId) ?? null;
  const contactNameFallback = detail?.contactName ?? selectedListItem?.contactName ?? selectedListItem?.contactPhone ?? null;

  return (
    <div className={styles.page} data-has-selection={selectedId !== null}>
      <div className={styles.listCol}>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <div className={styles.threadCol}>
        <div className={styles.threadArea}>
          <MessageThread
            conversationId={selectedId}
            contactName={contactNameFallback}
            messages={messages}
            isLoading={messagesQuery.isLoading}
            isError={messagesQuery.isError}
            onBack={() => setSelectedId(null)}
            onRetryAttachment={handleRetryAttachment}
          />
        </div>

        {selectedId && (
          <Composer
            conversationId={selectedId}
            canReply={!!detail?.canReply}
            isDetailLoading={detailQuery.isLoading}
            // Fix re-review fase 2 (regresión bloqueante): react-query v5
            // conserva `detailQuery.data` del último fetch exitoso cuando un
            // refetch de fondo (poll de 25s) falla — sin el `!detailQuery.data`
            // acá, un poll caído (ej. Chatwoot momentáneamente no disponible)
            // ponía `isDetailError:true` MIENTRAS `detail.canReply` seguía
            // siendo `true`, deshabilitando el composer y cortando una
            // respuesta en curso. Solo es un error "real" para el composer
            // cuando NO hay data previa a la que aferrarse.
            isDetailError={detailQuery.isError && !detailQuery.data}
          />
        )}
      </div>

      <div className={styles.contextCol}>
        {/* Fix bug BLOQUEANTE (review adversarial F1.5): `chosenId` (estado
            interno del container, para desambiguar `ambiguous`) NO se
            reseteaba al cambiar de conversación — quedaba "pegado" mostrando
            el candidato elegido en la conversación anterior. `key={selectedId}`
            fuerza un remount limpio (chosenId vuelve a null) cada vez que
            cambia la conversación seleccionada. */}
        <ClientContextPanel key={selectedId} conversationId={selectedId} lightContext={detail?.clientContext} />
      </div>
    </div>
  );
}
