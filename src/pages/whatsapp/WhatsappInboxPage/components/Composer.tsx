import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { useSendWhatsappMessage } from '@/hooks/useWhatsapp';
import { useComposerAttachments } from '@/hooks/useComposerAttachments';
import { ComposerAttachButton } from './ComposerAttachButton';
import { ComposerAttachmentTray } from './ComposerAttachmentTray';
import { ComposeModeToggle } from './ComposeModeToggle';
import type { ComposeMode } from './ComposeModeToggle';
import { TemplateSendPanel } from './TemplateSendPanel';
import { CannedResponsePicker } from './CannedResponsePicker';
import { MentionPopover } from './MentionPopover';
import { detectMentionQuery, filterMentionUsers, formatMentionToken, insertMention } from './mentions';
import { MAX_FILES } from '@/utils/validateAttachment';
import { mapSendError } from '@/utils/mapSendError';
import type { WhatsappAssignee, WhatsappClientContext } from '@/types/whatsapp';
import styles from './Composer.module.css';

interface ComposerProps {
  conversationId: string;
  /** Ventana de 24h de WhatsApp — resuelto por `useWhatsappConversation` (design §3), llega como prop. */
  canReply: boolean;
  /**
   * Bug #4 (post-review-adversarial, contrato): mientras el detalle de la
   * conversación (`useWhatsappConversation`) todavía está cargando, `canReply`
   * llega `undefined`/`false` porque el `detail` real todavía no resolvió —
   * SIN esta bandera el composer mostraba "ventana expirada" en CADA apertura
   * de thread (mintiendo un estado que ni siquiera se conoce todavía).
   */
  isDetailLoading?: boolean;
  /**
   * Bug #4: si el fetch del detalle FALLA, `detail` queda `undefined` para
   * siempre — sin esta bandera el composer quedaba mostrando "ventana
   * expirada" de forma PERMANENTE (mintiendo un error de red como si fuera
   * una regla de negocio real de WhatsApp).
   *
   * Fix re-review fase 2 (regresión bloqueante): esta bandera SOLO debe
   * bloquear cuando NO hay un `canReply` conocido-bueno. React Query v5
   * conserva `data` del último fetch exitoso cuando un refetch de fondo
   * (poll de 25s) falla — `isDetailError` se pone en `true` con `canReply`
   * TODAVÍA reflejando el último valor real. Sin este matiz, un poll caído
   * (ej. Chatwoot momentáneamente no disponible) deshabilitaba el composer y
   * cortaba una respuesta en curso aunque el detalle YA hubiera confirmado
   * `canReply:true`. Ver el guard en `disabled` más abajo.
   */
  isDetailError?: boolean;
  /**
   * Contexto LIGHT del detalle (`detail.clientContext`, F1) — threadeado tal
   * cual a `TemplateSendPanel` (FUENTES): decide si las opciones de datos
   * ("Nombre del cliente"/"Monto de deuda") están disponibles en las
   * variables del template. `Composer` NO lo usa para nada más. Opcional:
   * sin él, el panel se comporta como "sin cliente" (solo Valor fijo).
   */
  lightContext?: WhatsappClientContext | null;
  /**
   * Ola 6 (@menciones) — catálogo de agentes mencionables en una NOTA interna
   * (el MISMO que alimenta el control de asignación, `useAssignableUsers`;
   * `WhatsappInboxPage` lo threadea). Al tipear "@" en modo nota se abre el
   * popover con estos agentes; elegir inserta `@[Nombre](userId)`. Opcional con
   * default `[]` (cero regresión para call sites/tests previos: sin catálogo el
   * popover muestra "Sin coincidencias").
   */
  assignableUsers?: WhatsappAssignee[];
}

const MENTION_LISTBOX_ID = 'wa-mention-listbox';
const mentionOptionId = (index: number) => `${MENTION_LISTBOX_ID}-option-${index}`;

const WINDOW_EXPIRED_NOTICE = 'Ventana de 24h expirada — se necesita un template';
/** CTA-1 (inbox-template-send, design D11) — anunciado por `TEMPLATE_SENT_ANNOUNCEMENT` cuando el envío del panel resuelve OK. */
const TEMPLATE_SENT_ANNOUNCEMENT = 'Template enviado';
const VERIFYING_WINDOW_NOTICE = 'Verificando si podés responder…';
const VERIFY_WINDOW_ERROR_NOTICE =
  'No se pudo verificar si la ventana de 24 horas sigue abierta. Recargá la conversación para reintentar.';

// Bug MEDIO #9 (post-review-adversarial): `mapSendError` (`utils/mapSendError.ts`,
// molde `mapUploadError`) reemplaza el mapa local de antes — ese solo cubría
// 3 códigos (ventana/chatwoot/conversación) y dejaba `mapSendError` como
// código MUERTO (nunca importado); los códigos de adjuntos (413/415/
// TOO_MANY_FILES) caían al genérico "No se pudo enviar" sin explicar el
// motivo real. Única superficie de mapeo código→copy para el envío.

/**
 * Composer — textarea + botón de envío (messaging-inbox F1, design §1/§6,
 * COMPOSER-1; EXTENDIDO messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §4). `canReply` llega resuelto como prop (design §1: la
 * page orquesta `useWhatsappConversation`); la mutation de envío es DUEÑA
 * acá (`useSendWhatsappMessage`) — devuelve `{send,retry,discard,isError,
 * error}` (design §6.3), YA NO un `useMutation` crudo.
 *
 * 422 (`MESSAGING_WINDOW_EXPIRED`) / 503 (`CHATWOOT_UNAVAILABLE`): NO se
 * manejan con try/catch — se leen reactivamente de `isError`/`error`, que el
 * hook ya captura en su `onError` sin relanzar (el interceptor global de
 * axios solo cubre 401).
 *
 * Cambio clave vs. F1 (design §4.1): con optimistic UI el composer YA NO se
 * bloquea durante la subida — el mensaje sale al thread al instante (burbuja
 * optimista, `MessageThread`/`MessageBubble`) y el composer se limpia y
 * queda listo para el siguiente (patrón WhatsApp). El spinner de "enviando"
 * vive en la burbuja, no acá — por eso `disabled`/`canSend` YA NO dependen
 * de ningún `isPending` (el hook nuevo ni lo expone).
 */
export function Composer({ conversationId, canReply, isDetailLoading = false, isDetailError = false, lightContext, assignableUsers = [] }: ComposerProps) {
  const [content, setContent] = useState('');
  // messaging-inbox-notes F1.5 fase D (design §3.1): 'reply' es el default —
  // cero cambio de comportamiento al abrir el composer.
  const [mode, setMode] = useState<ComposeMode>('reply');
  const [modeAnnouncement, setModeAnnouncement] = useState('');
  // CTA-1 (inbox-template-send, design D11) — estado LOCAL del panel del
  // picker de templates. `templateAnnouncement` es un sr-only PERSISTENTE
  // (molde `modeAnnouncement` de acá arriba): el panel se DESMONTA al
  // cerrar (`TemplateSendPanel` no tiene prop `open`), así que el
  // announcement "Template enviado" no puede vivir dentro de él — tiene que
  // sobrevivir al desmonte para que el lector de pantalla lo alcance a leer.
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  // Bug MEDIO a11y (post-review-adversarial): antes esto era
  // `useState('')` seteado SIEMPRE a la MISMA constante
  // `TEMPLATE_SENT_ANNOUNCEMENT` en `handleTemplateSent` — del 2º envío en
  // adelante React hace bail-out (Object.is sobre el mismo string) y NO toca
  // el DOM, así que un lector de pantalla NUNCA re-anuncia los envíos
  // siguientes. El flujo real de este CTA es mandar templates a una COLA de
  // conversaciones (envíos repetidos), no un envío único — el bug era real.
  // Fix: un contador incremental que fuerza que el TEXTO renderizado cambie
  // en cada envío exitoso (ver `templateAnnouncement` derivado más abajo).
  const [templateSentCount, setTemplateSentCount] = useState(0);
  // Ola 4 (respuestas rápidas / macros) — estado LOCAL del picker de respuestas
  // rápidas. `openedBySlash` recuerda si se abrió tipeando "/" al inicio del
  // textarea vacío (vs. el botón 💬): al elegir, el "/" se REEMPLAZA por el
  // content; abierto por botón, el content se INSERTA en el caret. El picker es
  // hijo CONDICIONAL (solo montado al abrir) — su `useCannedResponses` no
  // fetchea el catálogo hasta entonces (mismo criterio lazy que TemplateSendPanel).
  const [cannedPickerOpen, setCannedPickerOpen] = useState(false);
  const [cannedOpenedBySlash, setCannedOpenedBySlash] = useState(false);
  // Bug CRÍTICO #4: `feedback` estaba en el hook pero NUNCA se destructuraba
  // acá — cuando se elegían más de `MAX_FILES` archivos, los excedentes
  // desaparecían en silencio (el hook los recortaba, pero nadie mostraba el
  // aviso). Ahora se destructura y se renderiza más abajo.
  const { drafts, add, remove, clear, discardAll, hasBlocking, feedback } = useComposerAttachments();
  const { send, isError, error } = useSendWhatsappMessage(conversationId);
  // Bug CRÍTICO #3: destino del foco cuando se quita el ÚLTIMO adjunto del
  // tray (`ComposerAttachmentTray.onEmptied`) — sin esto, el foco quedaba
  // perdido en `document.body`.
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);
  // design §3.4: al cambiar de modo, el foco vuelve al textarea (mismo nodo,
  // no se remonta entre modos) sin un Tab extra.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Ola 6 (@menciones) — estado del popover de menciones. `null` = cerrado.
  // `start` es el índice del "@" que lo abrió; `query` es lo tipeado tras el
  // "@" (filtro); `activeIndex` es la opción resaltada (teclado/mouse). Solo
  // se usa en modo nota (ver `handleContentChange`/`handleKeyDown`).
  const [mention, setMention] = useState<{ start: number; query: string; activeIndex: number } | null>(null);
  // Caret a restaurar tras insertar un token (el `setContent` controlado no
  // preserva la posición del caret por sí solo). `useLayoutEffect` lo aplica
  // antes del paint para que no se vea el salto.
  const pendingCaretRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaretRef.current !== null && textareaRef.current) {
      const pos = pendingCaretRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      pendingCaretRef.current = null;
    }
  });

  const trimmed = content.trim();
  const validDrafts = drafts.filter((d) => d.error === null);
  const validFiles = validDrafts.map((d) => d.file);
  const isNoteMode = mode === 'note';
  // Agentes visibles en el popover — filtrados por lo tipeado tras el "@".
  const mentionUsers = mention ? filterMentionUsers(assignableUsers, mention.query) : [];
  const isMentionOpen = isNoteMode && mention !== null;

  // Bug #4: mientras el detalle carga, todavía NO sabemos el `canReply`
  // real — deshabilitar es lo seguro (no dejar mandar un mensaje que el BE
  // podría rechazar con 422 porque en realidad la ventana SÍ expiró), pero
  // con el copy correcto (ver abajo), no el de "expirada".
  //
  // Fix re-review fase 2 (regresión bloqueante): `isDetailError` YA NO entra
  // acá directo — `!canReply` alcanza para cubrir "no sabemos si puede
  // responder" (canReply llega `false` tanto si la ventana genuinamente
  // expiró como si el detalle nunca resolvió). Cuando `canReply` es
  // conocido-bueno (`true`), un poll de fondo fallido NO debe cortar una
  // respuesta en curso — por eso `isDetailError` sola ya no deshabilita.
  //
  // messaging-inbox-notes F1.5 fase D (design §3.2, el punto delicado de esta
  // tanda): una NOTA interna nunca cruza a WhatsApp, así que la ventana de
  // 24h de Meta es irrelevante para ella — en modo nota el composer se
  // habilita SIEMPRE, sin importar `canReply`/`isDetailLoading`. Los dos
  // gatings NO se colapsan en un ternario: `canReply` sigue mandando en
  // reply, se ignora por completo en nota.
  const windowDisabled = mode === 'reply' && (isDetailLoading || !canReply);

  // F4.5 (design §4.1): "al menos uno" — texto O archivos válidos. Un draft
  // con error (type/size) bloquea el envío entero hasta que se saque.
  // Fase D (design §3.2): en modo nota, `validFiles` NO entra en el gate —
  // notas v1 son solo texto (adjuntos en nota, fuera de alcance v1).
  const canSend = !windowDisabled && !hasBlocking && (trimmed.length > 0 || (mode === 'reply' && validFiles.length > 0));

  function handleModeChange(next: ComposeMode) {
    // Fix-fe hallazgo #1/#2 (post-review-adversarial, causa raíz compartida):
    // entrar a modo nota abandona cualquier draft de reply a medio armar —
    // v1 de nota es texto-only (design §3.5), esos adjuntos NUNCA van a
    // viajar. Sin este `discardAll`, un draft inválido dejaba `hasBlocking`
    // colgado (bloqueaba "Agregar nota" sin tray visible para sacarlo —
    // hallazgo #1, el tray se oculta gateado a `mode==='reply'`) y sus
    // objectURL quedaban huérfanos, porque el único camino que usa `trySend`
    // es `clear()`, que por contrato NO revoca (esa revocación se la cede al
    // pipeline de envío — que en nota nunca ve estos drafts, hallazgo #2,
    // leak real). Sin drafts, no hay `hasBlocking` ni objectURL vivo que
    // leakear — se resuelve en el origen, no parcheando `canSend`.
    if (next === 'note') {
      discardAll();
    }
    // Ola 4: el picker de respuestas rápidas es exclusivo del modo reply — al
    // cambiar de modo se cierra (no debe quedar colgado sobre el modo nota, ni
    // arrastrar el flag "abierto por slash" a la próxima apertura en reply).
    setCannedPickerOpen(false);
    setCannedOpenedBySlash(false);
    // Ola 6 (@menciones): el popover de menciones es exclusivo del modo nota —
    // al cambiar de modo se cierra (no debe quedar colgado sobre el modo reply).
    setMention(null);
    setMode(next);
    setModeAnnouncement(next === 'note' ? 'Modo nota interna' : 'Modo respuesta');
    // El textarea es el MISMO nodo en ambos modos (nunca se remonta) — el
    // foco puede pedirse ya, sin esperar el próximo render.
    textareaRef.current?.focus();
  }

  /**
   * Bug MEDIO/BAJO #10 (post-review-adversarial): antes, `content`/`drafts`
   * se limpiaban en `onSuccess` — mientras la subida seguía en vuelo, el
   * composer mostraba el mismo texto/adjunto que YA estaba en la burbuja
   * optimista (duplicado visual); si el envío fallaba, el composer quedaba
   * poblado con un botón "Enviar" que reintentaría con un `tempId` DISTINTO
   * al de la burbuja `failed` (2 caminos de retry para el mismo mensaje).
   *
   * Ahora se limpia INMEDIATAMENTE al disparar, ANTES de llamar a `send` —
   * la burbuja optimista (`MessageThread`/`MessageBubble`) pasa a ser la
   * ÚNICA superficie del envío en curso, éxito o falla (retry/discard viven
   * ahí, `WhatsappInboxPage`). La propiedad de los `objectURL` de los drafts
   * pasa junto con `validDrafts`/`send` al pipeline (`useSendWhatsappMessage`
   * los revoca en `onSuccess`/`discard`) — `clear()` ya NO revoca (ver su
   * doc comment en `useComposerAttachments.ts`).
   */
  function trySend() {
    if (!canSend) return;
    // Fase D (design §3.5/§5): en modo nota los adjuntos NUNCA viajan, aunque
    // hubiera drafts cargados de un cambio de modo previo (reply→nota) — el
    // pipeline threadea `files`/`drafts` para cuando note-media llegue (v2),
    // pero v1 es texto-only. `isPrivate` viaja SOLO como `true` en nota; en
    // reply se omite (el hook lo defaultea a `false`), cero regresión de la
    // aserción exacta que ya cubren los tests de F1/F1.5.
    if (isNoteMode) {
      send({ content: trimmed, files: [], drafts: [], isPrivate: true });
    } else {
      send({ content: trimmed, files: validFiles, drafts: validDrafts });
    }
    setContent('');
    clear();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    trySend();
  }

  // Bug #11 (polish, post-review-adversarial): Enter envía, Shift+Enter hace
  // un salto de línea normal (no se llama preventDefault en ese caso — el
  // textarea inserta el \n por su cuenta). F4.5: si el textarea está vacío
  // pero hay files válidos, Enter IGUAL envía (media-sola) — `trySend` ya
  // lo cubre vía `canSend`.
  //
  // Bug BAJO #13d: mientras un IME (japonés/coreano/chino, etc.) está
  // componiendo un carácter, el Enter que el usuario usa para CONFIRMAR esa
  // composición NO debe enviar el mensaje — `nativeEvent.isComposing` es la
  // señal estándar para distinguirlo del Enter "real".
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Ola 6 (@menciones): con el popover abierto, ↑/↓/Enter/Esc lo gobiernan a
    // ÉL (el foco nunca sale del textarea — patrón aria-activedescendant), no
    // al composer. Enter elige la mención, JAMÁS envía la nota.
    if (isMentionOpen) {
      const len = mentionUsers.length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setMention((m) => (m ? { ...m, activeIndex: len === 0 ? 0 : (m.activeIndex + 1) % len } : m));
          return;
        case 'ArrowUp':
          e.preventDefault();
          setMention((m) => (m ? { ...m, activeIndex: len === 0 ? 0 : (m.activeIndex - 1 + len) % len } : m));
          return;
        case 'Enter':
          e.preventDefault();
          if (len > 0 && mention) selectMention(mentionUsers[mention.activeIndex]);
          else setMention(null);
          return;
        case 'Escape':
          e.preventDefault();
          // Corta la burbuja (mismo criterio que CannedResponsePicker/Select):
          // un Escape a nivel document no debe cerrar además un modal ancestro.
          e.stopPropagation();
          setMention(null);
          return;
        default:
          break;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      trySend();
    }
  }

  // CTA-1/SEND-1 (inbox-template-send, design D11) — el panel avisa OK vía
  // `onSent`: cierra (unmount) Y deja el announcement accesible. D2 (LOCKED):
  // acá NUNCA se toca `canReply`/`mode`/`content` — el template no abre la
  // ventana, el composer de texto libre queda EXACTAMENTE como estaba.
  function handleTemplateSent() {
    setTemplatePanelOpen(false);
    setTemplateSentCount((count) => count + 1);
  }

  /**
   * Ola 4 (respuestas rápidas) — onChange del textarea con detección del atajo
   * "/": cuando el textarea estaba VACÍO y el nuevo valor es exactamente "/"
   * (primer carácter tipeado), abre el picker marcándolo como "abierto por
   * slash". Cualquier otro "/" (en medio del texto, o con contenido previo) NO
   * dispara — el atajo es solo al inicio del composer vacío (patrón Chatwoot).
   */
  function handleContentChange(next: string, caret: number) {
    if (!cannedPickerOpen && mode === 'reply' && content === '' && next === '/') {
      setCannedPickerOpen(true);
      setCannedOpenedBySlash(true);
    }
    setContent(next);
    // Ola 6 (@menciones): solo en modo nota. Cada tecla recalcula si el caret
    // está dentro de una palabra "@…" (`detectMentionQuery`) — abre/actualiza
    // el popover o lo cierra. `activeIndex` vuelve al tope al cambiar el filtro
    // (las flechas no pasan por acá: no cambian el content).
    if (mode === 'note') {
      const detected = detectMentionQuery(next, caret);
      setMention(detected ? { start: detected.start, query: detected.query, activeIndex: 0 } : null);
    }
  }

  function openCannedPicker() {
    setCannedOpenedBySlash(false);
    setCannedPickerOpen(true);
  }

  function closeCannedPicker() {
    setCannedPickerOpen(false);
    setCannedOpenedBySlash(false);
    // El picker no es modal: al cerrar, el foco vuelve al textarea (mismo nodo,
    // nunca se remonta entre modos) para seguir escribiendo sin un Tab extra.
    textareaRef.current?.focus();
  }

  /**
   * Ola 4 — insertar el `content` de la respuesta elegida. Abierto por "/": el
   * textarea sólo tenía "/", se REEMPLAZA por el content. Abierto por botón: se
   * INSERTA en la posición del caret (o al final si el ref no está disponible),
   * preservando lo ya escrito. VARIABLES v1: si el content trae `{{variables}}`,
   * viajan LITERALES (no se resuelven en v1 — contrato acordado).
   */
  function handleCannedSelect(text: string) {
    if (cannedOpenedBySlash) {
      setContent(text);
    } else {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? content.length;
      const end = el?.selectionEnd ?? content.length;
      setContent(content.slice(0, start) + text + content.slice(end));
    }
    closeCannedPicker();
  }

  /**
   * Ola 6 (@menciones) — insertar el token del agente elegido. Reemplaza la
   * palabra `@…` (de `mention.start` al fin del query) por `@[Nombre](userId)`
   * + espacio. El caret queda tras el espacio (`pendingCaretRef`, aplicado en
   * el `useLayoutEffect`), y el foco vuelve al textarea (mismo nodo).
   */
  function selectMention(user: WhatsappAssignee) {
    if (!mention) return;
    const caretEnd = mention.start + mention.query.length + 1; // +1 por el "@"
    const token = formatMentionToken(user.name, user.id);
    const { text, caret } = insertMention(content, mention.start, caretEnd, token);
    setContent(text);
    setMention(null);
    pendingCaretRef.current = caret;
    textareaRef.current?.focus();
  }

  // Deriva el texto del announcement a partir del contador — el 1er envío
  // sigue leyendo EXACTAMENTE "Template enviado" (cero regresión de copy),
  // del 2º en adelante suma un sufijo "(N)" que garantiza que el string
  // CAMBIE respecto del envío anterior (mutación real del nodo de texto, no
  // solo un re-render con el mismo valor).
  const templateAnnouncement =
    templateSentCount === 0
      ? ''
      : templateSentCount === 1
        ? TEMPLATE_SENT_ANNOUNCEMENT
        : `${TEMPLATE_SENT_ANNOUNCEMENT} (${templateSentCount})`;

  return (
    <Can permission="messaging.send">
      <form
        className={styles.composer}
        onSubmit={handleSubmit}
        aria-label={isNoteMode ? 'Agregar nota interna' : 'Responder'}
      >
        <ComposeModeToggle mode={mode} onChange={handleModeChange} />

        {/* design §3.4: sr-only, anuncia el cambio de modo aunque el foco ya
            haya saltado al textarea (así un lector de pantalla confirma el
            cambio de contexto). */}
        <span className={styles.srOnly} role="status" aria-live="polite">
          {modeAnnouncement}
        </span>

        {/* CTA-1 (inbox-template-send, design D11/SEND-1) — sr-only,
            PERSISTENTE (sobrevive al desmonte del panel): anuncia el
            resultado del envío de template. Mismo criterio que
            `modeAnnouncement` de arriba — un `role="status"` DENTRO del
            panel no alcanzaría a ser leído porque el panel se desmonta al
            cerrar (`handleTemplateSent`). */}
        <span className={styles.srOnly} role="status" aria-live="polite">
          {templateAnnouncement}
        </span>

        {/* design §3.2: los 3 avisos de VENTANA solo tienen sentido en modo
            reply — una nota interna nunca cruza a WhatsApp, no hay ventana
            de 24h que verificar/haber expirado para ella. */}
        {mode === 'reply' && isDetailLoading && (
          <p className={styles.notice} role="status">
            {VERIFYING_WINDOW_NOTICE}
          </p>
        )}

        {/* Fix re-review fase 2: este banner de error solo tiene sentido cuando
            NO hay un `canReply` conocido-bueno — si `canReply` es `true`
            (React Query v5 conservó `data` pese al poll fallido), no hay nada
            que "verificar", el composer ya sabe que puede responder. */}
        {mode === 'reply' && !isDetailLoading && isDetailError && !canReply && (
          <p className={styles.error} role="alert">
            {VERIFY_WINDOW_ERROR_NOTICE}
          </p>
        )}

        {/* CTA-1 (inbox-template-send, design D11) — rama EXACTA del aviso
            estático: la ÚNICA de las 4 ramas de ventana (+ nota) donde el
            aviso pasa a aviso+acción. El botón vive DENTRO del mismo `<Can
            permission="messaging.send">` que envuelve todo el form — cero
            permiso nuevo (mismo guard que el envío). */}
        {mode === 'reply' && !isDetailLoading && !isDetailError && !canReply && (
          <>
            <p className={styles.notice} role="status">
              {WINDOW_EXPIRED_NOTICE}
            </p>
            <Button
              type="button"
              variant="secondary"
              className={styles.templateCtaButton}
              onClick={() => setTemplatePanelOpen(true)}
            >
              Enviar template
            </Button>
          </>
        )}

        {/* El error de ENVÍO real (422/503/etc, mapSendError) es distinto de
            los avisos de ventana de arriba — se muestra en AMBOS modos: un
            intento de nota también puede fallar. */}
        {isError && (
          <p className={styles.error} role="alert">
            {mapSendError(error)}
          </p>
        )}

        {/* Bug CRÍTICO #4: aviso de "máximo N archivos" — antes `feedback`
            no se destructuraba del hook, así que los archivos excedentes
            desaparecían en silencio al elegir más de MAX_FILES de una vez. */}
        {feedback && (
          <p className={styles.notice} role="status">
            {feedback}
          </p>
        )}

        {/* design §3.5: adjuntos FUERA de alcance v1 en modo nota — más
            limpio no montarlos que deshabilitarlos (nada que explicar). */}
        {mode === 'reply' && (
          <ComposerAttachmentTray
            drafts={drafts}
            onRemove={remove}
            onEmptied={() => attachBtnRef.current?.focus()}
          />
        )}

        {/* Ola 4 (respuestas rápidas / macros) — popover del picker, anclado
            SOBRE el composer (position:absolute, bottom:100% — ver
            Composer.module.css, `.composer` es el ancestro posicionado).
            Montado CONDICIONALMENTE: solo existe mientras el agente abrió el
            picker (botón 💬 o atajo "/"), así `useCannedResponses` no fetchea
            el catálogo hasta entonces. Exclusivo de modo reply. */}
        {mode === 'reply' && cannedPickerOpen && (
          <CannedResponsePicker onSelect={handleCannedSelect} onClose={closeCannedPicker} />
        )}

        {/* Ola 6 (@menciones) — popover de menciones, exclusivo del modo nota.
            Anclado sobre el composer (position:absolute, bottom:100% — mismo
            ancestro `.composer` que el CannedResponsePicker). El foco queda en
            el textarea; este popover solo pinta las opciones filtradas. */}
        {isMentionOpen && (
          <MentionPopover
            users={mentionUsers}
            activeIndex={mention?.activeIndex ?? 0}
            listboxId={MENTION_LISTBOX_ID}
            optionId={mentionOptionId}
            onSelect={selectMention}
            onHover={(idx) => setMention((m) => (m ? { ...m, activeIndex: idx } : m))}
          />
        )}

        <div className={styles.row}>
          {mode === 'reply' && (
            <ComposerAttachButton
              onFiles={add}
              disabled={windowDisabled}
              count={drafts.length}
              max={MAX_FILES}
              buttonRef={(el) => { attachBtnRef.current = el; }}
            />
          )}

          {/* Ola 4 — botón dedicado del picker de respuestas rápidas (💬).
              `aria-haspopup="listbox"` + `aria-expanded` describen el popover al
              lector de pantalla. Solo en modo reply, deshabilitado con la
              ventana cerrada (mismo gate que el resto de la fila de reply). */}
          {mode === 'reply' && (
            <button
              type="button"
              className={styles.cannedButton}
              onClick={openCannedPicker}
              disabled={windowDisabled}
              aria-label="Respuestas rápidas"
              aria-haspopup="listbox"
              aria-expanded={cannedPickerOpen}
              title="Respuestas rápidas"
            >
              <span aria-hidden="true">💬</span>
            </button>
          )}

          <label className={styles.srOnly} htmlFor="whatsapp-composer-input">
            {isNoteMode ? 'Nota interna' : 'Mensaje'}
          </label>
          <textarea
            id="whatsapp-composer-input"
            ref={textareaRef}
            className={styles.textarea}
            value={content}
            onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={handleKeyDown}
            // Ola 6 (@menciones): al perder el foco (click afuera / Tab) se
            // cierra el popover. Elegir una opción NO dispara blur (el
            // `onMouseDown` de la opción hace preventDefault → el foco queda).
            onBlur={() => setMention(null)}
            placeholder={isNoteMode ? 'Escribí una nota interna…' : drafts.length > 0 ? 'Agregá un texto…' : 'Escribí un mensaje…'}
            disabled={windowDisabled}
            // Ola 6 (@menciones): el textarea es el "input" del combobox de
            // menciones (patrón aria-activedescendant — el foco nunca sale de él).
            aria-haspopup={isNoteMode ? 'listbox' : undefined}
            aria-expanded={isMentionOpen || undefined}
            aria-controls={isMentionOpen && mentionUsers.length > 0 ? MENTION_LISTBOX_ID : undefined}
            aria-activedescendant={
              isMentionOpen && mention && mentionUsers.length > 0 ? mentionOptionId(mention.activeIndex) : undefined
            }
          />
          <Button
            type="submit"
            variant="primary"
            className={styles.sendButton}
            disabled={!canSend}
            aria-label={isNoteMode ? 'Agregar nota' : 'Enviar mensaje'}
          >
            {isNoteMode ? 'Agregar nota' : 'Enviar'}
          </Button>
        </div>
      </form>

      {/* CTA-1/SEND-1 (inbox-template-send, design D11) — montado/desmontado
          condicionalmente (SIN prop `open`): sólo existe mientras el agente
          efectivamente abrió el picker. Esto mantiene inerte a cualquier
          suite que auto-mockee `@/hooks/useWhatsapp` sin stubear
          `useSendableTemplates`/`useSendWhatsappTemplate` (ej.
          `WhatsappInboxPage.test.tsx`) — esos hooks nuevos NUNCA se llaman a
          menos que se clickee el CTA. `key={conversationId}` (design SEND-1,
          memoria `inbox-key-por-conversacion`): defensa explícita — aunque
          `Composer` YA remonta por `key={selectedId}` en
          `WhatsappInboxPage.tsx`, un cambio de conversación fuerza además un
          panel 100% limpio (selección/variables/idempotencyKey nunca
          sobreviven a un cambio de conv). */}
      {templatePanelOpen && (
        <TemplateSendPanel
          key={conversationId}
          conversationId={conversationId}
          onClose={() => setTemplatePanelOpen(false)}
          onSent={handleTemplateSent}
          lightContext={lightContext}
        />
      )}
    </Can>
  );
}
