import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useWhatsappConversations,
  useWhatsappConversation,
  useWhatsappMessages,
  useSendWhatsappMessage,
  useSetConversationStatus,
  useSetConversationAssignee,
  useSetConversationArea,
  useAssignableUsers,
  useMessagingAreas,
  usePendingSends,
  whatsappMessagesKey,
} from '@/hooks/useWhatsapp';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ConversationList } from './WhatsappInboxPage/components/ConversationList';
import { MessageThread } from './WhatsappInboxPage/components/MessageThread';
import { ClientContextPanel } from './WhatsappInboxPage/components/ClientContextPanel';
import { Composer } from './WhatsappInboxPage/components/Composer';
import type {
  ConversationAssignment,
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationStatus,
  WhatsappPaginatedQuery,
} from '@/types/whatsapp';
import styles from './WhatsappInboxPage.module.css';

const STATUS_ERROR_MESSAGE = 'No se pudo actualizar el estado de la conversación. Reintentá.';
// hallazgo HIGH #2 (review adversarial F1.5-C2): mismo mecanismo de toast
// que status — assignee/area piden el mismo permiso (`messaging.send`) y el
// mismo endpoint-family (`PATCH .../assignee`, `.../area`), así que pueden
// fallar por las mismas razones (403/500/503) sin ningún indicio hoy.
const ASSIGNEE_ERROR_MESSAGE = 'No se pudo actualizar el agente asignado. Reintentá.';
const AREA_ERROR_MESSAGE = 'No se pudo actualizar el área. Reintentá.';
const INBOX_TOAST_DURATION_MS = 4000;

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
  // messaging-inbox-assignment F1.5-C2: `query` ahora tiene setter — el
  // filtro Todas/Mías/Sin asignar (`ConversationAssignmentFilter`, montado
  // dentro de `ConversationList`) lo levanta hasta acá. `assignment` queda
  // AUSENTE del objeto (no `'all'` explícito) cuando el filtro está en
  // "Todas" — mismo criterio que `listWhatsappConversations` (solo manda el
  // param cuando viene definido) y preserva el estado inicial `{}` (cero
  // regresión del wiring/cache-key existentes).
  const [query, setQuery] = useState<WhatsappPaginatedQuery>({});
  const queryClient = useQueryClient();

  const conversationsQuery = useWhatsappConversations(query);
  const detailQuery = useWhatsappConversation(selectedId ?? '');
  const messagesQuery = useWhatsappMessages(selectedId ?? '');
  // messaging-inbox-v2-media F1.5 fase A, Tanda 2 (ENVIAR, design §6.3):
  // envíos en vuelo del thread abierto + retry/discard de una burbuja
  // `failed`. Instancia PROPIA de `useSendWhatsappMessage` (misma que usa
  // `Composer` para `send`) — ambas operan sobre el mismo slice de cache
  // (`whatsappPendingSendsKey`), no hace falta compartir el hook.
  const pendingSends = usePendingSends(selectedId ?? '');
  const { retry: retryPendingSend, discard: discardPendingSend } = useSendWhatsappMessage(selectedId ?? '');
  // messaging-inbox-productivity F1.5-C v1 (Resolver/Reabrir): instancia
  // PROPIA de useSetConversationStatus, atada al selectedId igual que
  // useSendWhatsappMessage — mismo criterio (las keys de cache de la
  // mutation se derivan del convId capturado AL DISPATCH, no del closure
  // `id` de este hook; ver `useWhatsapp.ts`).
  const { setStatus, isPending: isStatusPending } = useSetConversationStatus(selectedId ?? '');
  // messaging-inbox-assignment F1.5-C2 (ASIGNACIÓN): mismo criterio que
  // useSetConversationStatus (instancia PROPIA atada al selectedId; las keys
  // de cache de la mutation se derivan del convId capturado AL DISPATCH, ver
  // `useWhatsapp.ts`). Los catálogos (`useAssignableUsers`/`useMessagingAreas`)
  // son de PÁGINA, no por-conversación — se LLAMAN incondicionalmente (regla
  // de hooks: nunca detrás de un `if`), pero su fetch real queda gateado por
  // `enabled` (hallazgo LOW #6, review adversarial): sin `messaging.send` el
  // usuario no puede asignar nada, así que no tiene sentido pedir el
  // catálogo. Mismo permiso que gatea la UI (`<Can permission="messaging.send">`
  // en `MessageThread.tsx`), leído acá vía `useMyPermissions()` directamente.
  const { setAssignee, isPending: isAssigneePending } = useSetConversationAssignee(selectedId ?? '');
  const { setArea, isPending: isAreaPending } = useSetConversationArea(selectedId ?? '');
  const { can } = useMyPermissions();
  const canAssign = can('messaging.send');
  const { data: assignableUsers = [] } = useAssignableUsers(canAssign);
  const { data: messagingAreas = [] } = useMessagingAreas(canAssign);

  /**
   * hallazgo MEDIUM #3 (review adversarial F1.5-C): `useSetConversationStatus`
   * exponía `isError`/`error`, pero acá se descartaban por completo — si el
   * POST fallaba (403/500/503), el único indicio para el agente era el badge
   * de estado animándose ida y vuelta (rollback optimista), sin ningún
   * aviso. Mismo mecanismo de toast local que YA usa el resto del repo
   * (`TicketsTableView`/`RecaptacionPage`/`SchedulingTaskDetailPage`: no hay
   * un `useToast`/`ToastContext` global instalado, cada page/tabla mantiene
   * su propio estado `toast`+`showToast` con un banner `role="alert"`) — NO
   * se inventa un mecanismo nuevo, se replica el existente.
   *
   * hallazgo HIGH #2 (review adversarial F1.5-C2): generalizado a
   * `inboxToast` (antes `statusToast`, exclusivo de Resolver/Reabrir) — las
   * mutations de assignee/area (`onAssigneeChange`/`onAreaChange` de acá
   * abajo) pegan al mismo endpoint-family y pueden fallar por las mismas
   * razones, pero quedaban SIN ningún feedback (a diferencia de status). Un
   * solo estado de toast alcanza: las 3 mutations son mutuamente excluyentes
   * en la UI (un solo control a la vez dispara un cambio), así que no hace
   * falta un stack de banners.
   *
   * Se engancha vía el 2do argumento de `setStatus`/`setAssignee`/`setArea`
   * (`opts.onError`, `useWhatsapp.ts`) en vez de un `useEffect` observando
   * `isError` reactivamente — evita el problema de "cómo distingo un error
   * nuevo de uno viejo que ya mostré" que un efecto sobre estado persistente
   * de TanStack Query arrastraría.
   */
  const [inboxToast, setInboxToast] = useState<string | null>(null);
  const inboxToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showInboxToast(message: string) {
    setInboxToast(message);
    if (inboxToastTimer.current) clearTimeout(inboxToastTimer.current);
    inboxToastTimer.current = setTimeout(() => setInboxToast(null), INBOX_TOAST_DURATION_MS);
  }

  function handleToggleStatus(next: WhatsappConversationStatus) {
    setStatus(next, { onError: () => showInboxToast(STATUS_ERROR_MESSAGE) });
  }

  function handleAssigneeChange(next: WhatsappAssignee | null) {
    setAssignee(next, { onError: () => showInboxToast(ASSIGNEE_ERROR_MESSAGE) });
  }

  function handleAreaChange(next: WhatsappArea | null) {
    setArea(next, { onError: () => showInboxToast(AREA_ERROR_MESSAGE) });
  }

  /**
   * F1.5-C2 (ASIGNACIÓN) — cambia el filtro server-side de la lista.
   * `undefined` cuando vuelve a "all": mantiene `{}` como identidad estable
   * del estado inicial (mismo cache entry, ver comment de `query` arriba).
   */
  function handleAssignmentChange(next: ConversationAssignment) {
    setQuery((q) => ({ ...q, assignment: next === 'all' ? undefined : next }));
  }

  /**
   * Re-review MEDIUM (contaminación entre conversaciones, memoria
   * `inbox-key-por-conversacion` — nos mordió 2 veces): `inboxToast` es
   * estado de ESTA página (que NO se remonta al cambiar `selectedId`) y solo
   * se limpiaba por su timeout de 4s. Sin esto, un error del Resolver/Reabrir
   * (o de asignación, hallazgo HIGH #2) de la conversación A quedaba visible
   * sobre la B si el agente cambiaba dentro de esa ventana — el banner
   * genérico ("no se pudo actualizar…") leería como que la conversación
   * ACTUAL falló cuando fue otra. Al cambiar de conversación, descartar el
   * toast (y su timer) inmediatamente.
   */
  useEffect(() => {
    setInboxToast(null);
    if (inboxToastTimer.current) {
      clearTimeout(inboxToastTimer.current);
      inboxToastTimer.current = null;
    }
  }, [selectedId]);

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
          assignment={query.assignment ?? 'all'}
          onAssignmentChange={handleAssignmentChange}
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
            pendingSends={pendingSends}
            onRetryPending={retryPendingSend}
            onDiscardPending={discardPendingSend}
            status={detail?.status ?? selectedListItem?.status ?? null}
            onToggleStatus={handleToggleStatus}
            isStatusPending={isStatusPending}
            assignee={detail?.assignee ?? selectedListItem?.assignee ?? null}
            area={detail?.area ?? selectedListItem?.area ?? null}
            assignableUsers={assignableUsers}
            areas={messagingAreas}
            onAssigneeChange={handleAssigneeChange}
            onAreaChange={handleAreaChange}
            isAssigneePending={isAssigneePending}
            isAreaPending={isAreaPending}
          />
        </div>

        {selectedId && (
          <Composer
            // Fix bug CRÍTICO #1 (post-review-adversarial): sin `key`, cambiar
            // A→B durante un envío/borrador re-renderiza esta MISMA instancia
            // de `Composer` con un `conversationId` nuevo — el estado local
            // (`content`, drafts de `useComposerAttachments`) sobrevivía al
            // cambio, así que el mensaje/borrador de A terminaba viéndose (o
            // enviándose) en B. `key={selectedId}` fuerza un remount limpio
            // por conversación (mismo patrón que `ClientContextPanel` de acá
            // abajo, y que `MessageThread.swap` internamente). La defensa
            // COMPLEMENTARIA (para un envío YA en vuelo cuando el usuario
            // cambia de conversación, no solo el estado local del composer)
            // vive en `useSendWhatsappMessage` (`useWhatsapp.ts`): todas las
            // keys de cache se derivan de `vars.convId`, nunca del closure `id`.
            key={selectedId}
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

      {/* hallazgo MEDIUM #3 / HIGH #2: toast local (mismo mecanismo que
          TicketsTableView/RecaptacionPage/SchedulingTaskDetailPage — no hay
          un ToastContext/useToast global en el repo). Cubre status/assignee/
          area — ver `inboxToast` arriba. */}
      {inboxToast && (
        <div className={styles.statusToast} role="alert" aria-live="assertive">
          {inboxToast}
        </div>
      )}
    </div>
  );
}
