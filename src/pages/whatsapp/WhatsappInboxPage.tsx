import { useEffect, useMemo, useRef, useState } from 'react';
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
  useInboxViewCounts,
  usePendingSends,
  whatsappMessagesKey,
} from '@/hooks/useWhatsapp';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useCampaigns } from '@/hooks/useBulkMessaging';
import { ConversationList } from './WhatsappInboxPage/components/ConversationList';
import { InboxViewsMenu } from './WhatsappInboxPage/components/InboxViewsMenu';
import { INBOX_VIEW_PRESETS, INBOX_VIEW_EMPTY_MESSAGES } from './WhatsappInboxPage/components/inboxViews';
import type { InboxViewId } from './WhatsappInboxPage/components/inboxViews';
import { MessageThread } from './WhatsappInboxPage/components/MessageThread';
import { ClientContextPanel } from './WhatsappInboxPage/components/ClientContextPanel';
import { Composer } from './WhatsappInboxPage/components/Composer';
import type {
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationStatus,
  WhatsappPaginatedQuery,
} from '@/types/whatsapp';
import styles from './WhatsappInboxPage.module.css';

/**
 * F1.5 spec #1 (panel de contexto COLAPSABLE, estilo Chatwoot) — key de
 * localStorage para persistir la preferencia de colapso del panel de
 * contexto. Prefijo `wa:` (namespace del inbox WhatsApp, evita colisión con
 * otras keys del repo tipo `tickets-visible-columns`).
 */
const CONTEXT_COLLAPSED_STORAGE_KEY = 'wa:context-collapsed';

/**
 * Mismo criterio que `useVisibleColumns` (tickets/scheduling): lectura
 * best-effort, con try/catch por si localStorage no está disponible (modo
 * privado / contexto sin storage) — nunca debe tirar la página abajo por
 * esto. Default `false` (panel abierto) si no hay nada guardado o si la
 * lectura falla.
 */
function readStoredContextCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONTEXT_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const STATUS_ERROR_MESSAGE = 'No se pudo actualizar el estado de la conversación. Reintentá.';
// hallazgo HIGH #2 (review adversarial F1.5-C2): mismo mecanismo de toast
// que status — assignee/area piden el mismo permiso (`messaging.send`) y el
// mismo endpoint-family (`PATCH .../assignee`, `.../area`), así que pueden
// fallar por las mismas razones (403/500/503) sin ningún indicio hoy.
const ASSIGNEE_ERROR_MESSAGE = 'No se pudo actualizar el agente asignado. Reintentá.';
const AREA_ERROR_MESSAGE = 'No se pudo actualizar el área. Reintentá.';
const INBOX_TOAST_DURATION_MS = 4000;
// inbox-resolve (UNDO-1, design.md D6) — "Conversación resuelta — Deshacer"
// vive ~5s (más que el toast de error: es una ACCIÓN ofrecida, no solo un
// aviso, el agente necesita tiempo real para decidir si la deshace).
const UNDO_TOAST_MESSAGE = 'Conversación resuelta';
const UNDO_TOAST_DURATION_MS = 5000;

/**
 * WhatsappInboxPage — container del inbox WhatsApp (messaging-inbox F1,
 * design §1/§2/§4, FB4). Orquesta los hooks de `useWhatsapp.ts` (FB1) y
 * compone los paneles presentacionales (FB2/FB3) vía props — este archivo
 * NO tiene lógica de negocio propia, solo wiring + el layout full-height
 * (`WhatsappInboxPage.module.css`, primer opt-out local del padding de
 * `AdminLayout` en el repo). inbox-views Ola 1 lo llevó de 3 a 4 columnas:
 * sub-menú de vistas (`InboxViewsMenu`) | lista | thread | contexto.
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
  // inbox-views (Ola 1): la vista activa del sub-menú lateral (`InboxViewsMenu`)
  // es la ÚNICA fuente de status/assignment/view del listado — reemplaza a los
  // viejos tabs Abiertas/Resueltas + radios Todas/Mías/Sin asignar de la barra
  // de la lista. Default `'all'` = preset `{status:'open'}`, IDÉNTICO al
  // estado inicial histórico (mismo cache entry de React Query, cero regresión).
  const [activeView, setActiveView] = useState<InboxViewId>('all');
  // `query` sigue siendo el estado que viaja a `useWhatsappConversations` —
  // las vistas lo SETEAN por preset (`INBOX_VIEW_PRESETS`, ver
  // `handleViewChange`), el filtro de campaña lo complementa (eje ortogonal,
  // `handleCampaignChange`) y la búsqueda queda client-side en la lista.
  //
  // inbox-resolve (design.md D5): el preset de 'all' manda `status:'open'`
  // explícito (default VISUAL del FE) — el default del CONTRATO BE sigue
  // siendo "sin filtro" (D2), no se confía en un default implícito del server.
  const [query, setQuery] = useState<WhatsappPaginatedQuery>({ status: 'open' });
  const queryClient = useQueryClient();

  // F1.5 spec #1 (panel de contexto COLAPSABLE) — lazy-init desde
  // localStorage (mismo patrón que `useVisibleColumns`): el lector corre UNA
  // sola vez, en el initializer de `useState`, no en cada render.
  const [contextCollapsed, setContextCollapsed] = useState<boolean>(() => readStoredContextCollapsed());

  // Persistencia best-effort — mismo criterio que `useVisibleColumns`: si
  // falla (quota / modo privado), no rompe el toggle, solo no sobrevive el
  // próximo reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CONTEXT_COLLAPSED_STORAGE_KEY, String(contextCollapsed));
    } catch {
      // Ignorado a propósito — ver comentario de arriba.
    }
  }, [contextCollapsed]);

  function toggleContext() {
    setContextCollapsed((prev) => !prev);
  }

  const conversationsQuery = useWhatsappConversations(query);
  // inbox-views (Ola 1): contadores por vista para los badges del sub-menú.
  // Polling 30s + invalidación explícita en las mutations de status/assignee
  // (ver `useWhatsapp.ts`). Si el GET falla (403 sin messaging:read / 503),
  // `data` queda undefined y el sub-menú degrada a "sin números" — nunca roto.
  const viewCountsQuery = useInboxViewCounts();
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

  // messaging-bulk-inbox Change 2 (filtro de campaña): catálogo de PÁGINA
  // (no por-conversación) que alimenta el `ConversationCampaignFilter` de la
  // lista. Gateado por `messaging.bulk` (mismo criterio que los catálogos de
  // asignación con `messaging.send`): sin ese permiso el endpoint
  // `/messaging/bulk/campaigns` da 403, y de todos modos el filtro solo tiene
  // sentido para quien conoce/opera campañas. El chip de campaña de la fila NO
  // depende de esto (viene en el DTO de la lista, sin permiso extra).
  const canBulk = can('messaging.bulk');
  const { data: campaignsPage } = useCampaigns({ limit: 50 }, canBulk);
  const campaigns = useMemo(
    () => (campaignsPage?.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [campaignsPage],
  );

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
   *
   * inbox-resolve (UNDO-1, design.md D6) — `inboxToast` pasa de `string` a
   * una unión discriminada: el toast de ERROR (existente) y el toast de
   * UNDO (resolver) comparten el mismo slice de estado (sigue siendo UN
   * solo toast a la vez — mismo criterio que el comentario de arriba), pero
   * el de undo necesita cargar el `convId` CAPTURADO AL DISPATCH (disciplina
   * `vars.convId` de `useSetConversationStatus`, memoria
   * `inbox-key-por-conversacion`) para que "Deshacer" nunca pueda disparar
   * sobre la conversación equivocada.
   */
  type InboxToast = { kind: 'error'; message: string } | { kind: 'undo'; message: string; convId: string };
  const [inboxToast, setInboxToast] = useState<InboxToast | null>(null);
  const inboxToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * MEDIUM 5.1 (review adversarial, fix wave) — el toast de undo tiene un
   * control ACCIONABLE ("Deshacer") dentro de un contenedor que antes era
   * `role="alert"`/`aria-live="assertive"`: eso interrumpía la lectura de
   * pantalla para un ÉXITO RUTINARIO (correcto solo para el toast de ERROR,
   * que sigue siendo `alert`/`assertive` más abajo) y, más grave, el botón
   * era efectivamente mouse-only — nada movía el foco ni para teclado ni
   * para lector de pantalla, así que "Deshacer" quedaba inalcanzable sin
   * tabular manualmente toda la página dentro de los 5s de vida del toast.
   *
   * `undoButtonRef` — el botón "Deshacer" en sí (destino del foco al
   * aparecer). `previousFocusRef` — el elemento que tenía el foco ANTES de
   * mostrarse el toast (típicamente el botón "Resolver" que lo disparó),
   * destino de la restauración al cerrarse. `undoButtonHasFocusRef` — NO se
   * puede chequear `document.activeElement === undoButtonRef.current`
   * DENTRO del cleanup del efecto de abajo: para cuando ese cleanup corre,
   * React ya desmontó el botón (limpió el ref a `null`) como parte del
   * commit que le precede — comparar contra un ref ya nuleado nunca
   * matchearía. Se trackea con `onFocus`/`onBlur` nativos en el propio
   * botón, que sí sobreviven al unmount (mismo patrón que Radix/Reach UI
   * para "restore focus on close").
   */
  const undoButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const undoButtonHasFocusRef = useRef(false);

  function dismissInboxToast() {
    setInboxToast(null);
    if (inboxToastTimer.current) {
      clearTimeout(inboxToastTimer.current);
      inboxToastTimer.current = null;
    }
  }

  function showInboxToast(message: string) {
    setInboxToast({ kind: 'error', message });
    if (inboxToastTimer.current) clearTimeout(inboxToastTimer.current);
    inboxToastTimer.current = setTimeout(() => setInboxToast(null), INBOX_TOAST_DURATION_MS);
  }

  /**
   * UNDO-1 — toast de acción tras resolver. El toast de ERROR (arriba) tiene
   * PRIORIDAD si el POST falla: como ambos escriben el mismo estado
   * (`setInboxToast`) y `onError` de la mutation SIEMPRE llega DESPUÉS de
   * este dispatch síncrono (nunca antes — ni siquiera con latencia cero, la
   * red es async), un error posterior overwritea el toast de undo
   * automáticamente, sin lógica de prioridad explícita.
   */
  function showUndoToast(convId: string) {
    setInboxToast({ kind: 'undo', message: UNDO_TOAST_MESSAGE, convId });
    if (inboxToastTimer.current) clearTimeout(inboxToastTimer.current);
    inboxToastTimer.current = setTimeout(() => setInboxToast(null), UNDO_TOAST_DURATION_MS);
  }

  /**
   * MEDIUM 5.1 (review adversarial, fix wave) — foco management del toast de
   * undo. Se dispara únicamente en la transición HACIA `kind:'undo'` (dep
   * `[inboxToast]`, que solo cambia de referencia cuando `setInboxToast` se
   * llama de nuevo — mostrar/descartar/reemplazar-por-error, nunca en un
   * re-render espurio): captura qué tenía el foco justo antes (típicamente
   * el botón "Resolver" que disparó el toast — el click todavía no movió el
   * foco a esta altura) y lo mueve al botón "Deshacer", que recién se montó.
   *
   * Mover el foco acá es seguro/esperado (no "roba" foco de forma molesta):
   * el ÚNICO disparador de `showUndoToast` es el click en el botón de
   * header "Resolver" (`handleToggleStatus`) — el foco YA estaba en un
   * botón del header, nunca en el Composer, así que no hay draft de
   * mensaje que interrumpir. El moveimiento es UNA sola vez al aparecer, no
   * se repite en cada render mientras el toast sigue montado.
   *
   * El cleanup restaura el foco SOLO si sigue estando en el botón "Deshacer"
   * al momento de desmontarse (timeout de 5s / click en "Deshacer" / cambio
   * de conversación) — si el agente ya lo movió a otro lado (ej. empezó a
   * tipear en el Composer mientras el toast seguía visible), no se lo
   * robamos de vuelta.
   */
  useEffect(() => {
    if (inboxToast?.kind !== 'undo') return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    undoButtonRef.current?.focus();
    return () => {
      if (undoButtonHasFocusRef.current) {
        previousFocusRef.current?.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismo criterio que el resto de los efectos de este archivo (refs estables, no van en deps).
  }, [inboxToast]);

  function handleToggleStatus(next: WhatsappConversationStatus) {
    // Capturado AL DISPATCH — nunca `selectedId` al momento del click en
    // "Deshacer" (que podría, en teoría, haber cambiado si algún día se
    // relaja el efecto de abajo que descarta el toast al cambiar de
    // conversación). Mismo criterio que `vars.convId` en
    // `useSetConversationStatus` (`useWhatsapp.ts`).
    const convId = selectedId;
    // UNDO-1 es SOLO para resolver (D6) — reabrir no ofrece "Deshacer".
    // Se dispara ANTES de `setStatus` a propósito: así, si `onError` llegara
    // a correr sincrónicamente (nunca pasa en producción, pero blinda el
    // orden igual), el toast de error sigue ganando por escribirse último.
    if (next === 'resolved' && convId) showUndoToast(convId);
    setStatus(next, { onError: () => showInboxToast(STATUS_ERROR_MESSAGE) });
  }

  /**
   * UNDO-1 — "Deshacer" reabre la conversación resuelta. Cinturón: solo
   * dispara si `convId` (capturado al resolver) sigue siendo la conversación
   * ACTUALMENTE seleccionada — invariante que YA garantiza el efecto de
   * abajo (el toast se descarta al cambiar de conversación), pero el guard
   * cuesta 2 líneas y blinda contra un futuro refactor de ese efecto.
   */
  function handleUndoResolve(convId: string) {
    if (convId !== selectedId) return;
    setStatus('open', { onError: () => showInboxToast(STATUS_ERROR_MESSAGE) });
    dismissInboxToast();
  }

  function handleAssigneeChange(next: WhatsappAssignee | null) {
    setAssignee(next, { onError: () => showInboxToast(ASSIGNEE_ERROR_MESSAGE) });
  }

  function handleAreaChange(next: WhatsappArea | null) {
    setArea(next, { onError: () => showInboxToast(AREA_ERROR_MESSAGE) });
  }

  /**
   * inbox-views (Ola 1) — cambio de vista del sub-menú. El preset REEMPLAZA
   * los 3 ejes que el sub-menú gobierna (status/assignment/view — spread del
   * preset entero, sin arrastrar los del preset anterior: los presets son
   * EXCLUYENTES, "Resueltas" después de "Mi bandeja" no queda "resueltas
   * mías") y PRESERVA solo `campaignId` (eje ortogonal, dueño: el filtro de
   * campaña de la lista). La búsqueda ni aparece acá — es client-side de
   * `ConversationList`, el query nunca la conoció.
   */
  function handleViewChange(next: InboxViewId) {
    setActiveView(next);
    setQuery((q) => ({ ...INBOX_VIEW_PRESETS[next], campaignId: q.campaignId }));
  }

  /**
   * messaging-bulk-inbox Change 2 — cambia el filtro server-side por campaña.
   * `undefined` cuando se vuelve a "Todas las campañas": mismo criterio que
   * `handleAssignmentChange` (React Query dropea las keys `undefined` al
   * hashear, así `{campaignId: undefined}` colapsa al mismo cache entry que el
   * estado inicial `{}` — cero regresión del wiring existente).
   */
  function handleCampaignChange(next: string | undefined) {
    setQuery((q) => ({ ...q, campaignId: next }));
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
   *
   * inbox-resolve (UNDO-1): la MISMA disciplina cubre el toast de undo
   * "sin código extra" — es el mecanismo que garantiza que "Deshacer" nunca
   * quede visible (ni accionable) sobre una conversación distinta a la que
   * se resolvió.
   */
  useEffect(() => {
    dismissInboxToast();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dismissInboxToast` no cambia entre renders de forma relevante (cierra sobre refs/setters estables); declararla en deps dispararía el efecto de más.
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
    <div
      className={styles.page}
      data-has-selection={selectedId !== null}
      data-context-collapsed={contextCollapsed}
    >
      {/* inbox-views (Ola 1) — sub-menú lateral de vistas (columna propia,
          la más angosta, a la IZQUIERDA de la lista — grid de 4 columnas, ver
          WhatsappInboxPage.module.css). Colapsa a rail de íconos por CSS en
          viewport angosto (automático, sin toggle manual — decisión
          documentada en InboxViewsMenu.module.css). */}
      <div className={styles.viewsCol}>
        <InboxViewsMenu active={activeView} counts={viewCountsQuery.data} onSelect={handleViewChange} />
      </div>

      <div className={styles.listCol}>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          selectedId={selectedId}
          onSelect={setSelectedId}
          // `query.status ?? 'open'`: la vista "Sin atender" no manda status
          // (view gana en el BE) y cae en el bucket abierto del cinturón
          // client-side — correcto, sus filas son todas no-resueltas.
          status={query.status ?? 'open'}
          emptyMessage={INBOX_VIEW_EMPTY_MESSAGES[activeView]}
          campaigns={campaigns}
          campaignId={query.campaignId}
          onCampaignChange={handleCampaignChange}
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
            contextCollapsed={contextCollapsed}
            onToggleContext={toggleContext}
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
            // FUENTES (TemplateSendPanel): el MISMO contexto light que
            // alimenta a ClientContextPanel — decide si las variables del
            // template pueden resolverse con datos del cliente.
            lightContext={detail?.clientContext}
          />
        )}
      </div>

      {/* F1.5 spec #1 (panel de contexto COLAPSABLE) — `id` referenciado por
          el `aria-controls` del botón toggle en `MessageThread` (constante
          `CONTEXT_PANEL_ID`, mismo valor literal en los dos lugares). El
          colapso es PURO CSS (`data-context-collapsed` en `.page` arriba +
          WhatsappInboxPage.module.css) — este div NUNCA se desmonta, así que
          `ClientContextPanel` (y su `key={selectedId}` de abajo) tampoco: re-
          abrir el panel es instantáneo, sin refetch. */}
      <div className={styles.contextCol} id="wa-client-context">
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
          area (kind:'error') y UNDO-1 (kind:'undo', inbox-resolve) — ver
          `inboxToast` arriba.

          MEDIUM 5.1 (review adversarial, fix wave) — role/aria-live AHORA
          dependen del `kind`: el toast de ERROR sigue siendo
          `role="alert"`/`aria-live="assertive"` (correcto — debe interrumpir,
          es una falla real). El de UNDO pasa a `role="status"`/
          `aria-live="polite"` (éxito RUTINARIO — no debe interrumpir la
          lectura de pantalla); el control accionable ("Deshacer") se vuelve
          alcanzable vía foco programático (ver el efecto de arriba), no vía
          `aria-live="assertive"`. */}
      {inboxToast && (
        <div
          className={styles.statusToast}
          data-kind={inboxToast.kind}
          role={inboxToast.kind === 'error' ? 'alert' : 'status'}
          aria-live={inboxToast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span>{inboxToast.message}</span>
          {inboxToast.kind === 'undo' && (
            <button
              ref={undoButtonRef}
              type="button"
              className={styles.toastAction}
              onClick={() => handleUndoResolve(inboxToast.convId)}
              onFocus={() => {
                undoButtonHasFocusRef.current = true;
              }}
              onBlur={() => {
                undoButtonHasFocusRef.current = false;
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
