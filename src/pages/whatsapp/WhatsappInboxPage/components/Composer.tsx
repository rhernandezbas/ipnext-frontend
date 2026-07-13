import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { useSendWhatsappMessage } from '@/hooks/useWhatsapp';
import { useComposerAttachments } from '@/hooks/useComposerAttachments';
import { ComposerAttachButton } from './ComposerAttachButton';
import { ComposerAttachmentTray } from './ComposerAttachmentTray';
import { MAX_FILES } from '@/utils/validateAttachment';
import { mapSendError } from '@/utils/mapSendError';
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
}

const WINDOW_EXPIRED_NOTICE = 'Ventana de 24h expirada — se necesita un template';
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
export function Composer({ conversationId, canReply, isDetailLoading = false, isDetailError = false }: ComposerProps) {
  const [content, setContent] = useState('');
  // Bug CRÍTICO #4: `feedback` estaba en el hook pero NUNCA se destructuraba
  // acá — cuando se elegían más de `MAX_FILES` archivos, los excedentes
  // desaparecían en silencio (el hook los recortaba, pero nadie mostraba el
  // aviso). Ahora se destructura y se renderiza más abajo.
  const { drafts, add, remove, clear, hasBlocking, feedback } = useComposerAttachments();
  const { send, isError, error } = useSendWhatsappMessage(conversationId);
  // Bug CRÍTICO #3: destino del foco cuando se quita el ÚLTIMO adjunto del
  // tray (`ComposerAttachmentTray.onEmptied`) — sin esto, el foco quedaba
  // perdido en `document.body`.
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);

  const trimmed = content.trim();
  const validDrafts = drafts.filter((d) => d.error === null);
  const validFiles = validDrafts.map((d) => d.file);

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
  const windowDisabled = isDetailLoading || !canReply;

  // F4.5 (design §4.1): "al menos uno" — texto O archivos válidos. Un draft
  // con error (type/size) bloquea el envío entero hasta que se saque.
  const canSend = !windowDisabled && !hasBlocking && (trimmed.length > 0 || validFiles.length > 0);

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
    send({ content: trimmed, files: validFiles, drafts: validDrafts });
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
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      trySend();
    }
  }

  return (
    <Can permission="messaging.send">
      <form className={styles.composer} onSubmit={handleSubmit} aria-label="Responder">
        {isDetailLoading && (
          <p className={styles.notice} role="status">
            {VERIFYING_WINDOW_NOTICE}
          </p>
        )}

        {/* Fix re-review fase 2: este banner de error solo tiene sentido cuando
            NO hay un `canReply` conocido-bueno — si `canReply` es `true`
            (React Query v5 conservó `data` pese al poll fallido), no hay nada
            que "verificar", el composer ya sabe que puede responder. */}
        {!isDetailLoading && isDetailError && !canReply && (
          <p className={styles.error} role="alert">
            {VERIFY_WINDOW_ERROR_NOTICE}
          </p>
        )}

        {!isDetailLoading && !isDetailError && !canReply && (
          <p className={styles.notice} role="status">
            {WINDOW_EXPIRED_NOTICE}
          </p>
        )}

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

        <ComposerAttachmentTray
          drafts={drafts}
          onRemove={remove}
          onEmptied={() => attachBtnRef.current?.focus()}
        />

        <div className={styles.row}>
          <ComposerAttachButton
            onFiles={add}
            disabled={windowDisabled}
            count={drafts.length}
            max={MAX_FILES}
            buttonRef={(el) => { attachBtnRef.current = el; }}
          />

          <label className={styles.srOnly} htmlFor="whatsapp-composer-input">
            Mensaje
          </label>
          <textarea
            id="whatsapp-composer-input"
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={drafts.length > 0 ? 'Agregá un texto…' : 'Escribí un mensaje…'}
            disabled={windowDisabled}
          />
          <Button
            type="submit"
            variant="primary"
            className={styles.sendButton}
            disabled={!canSend}
            aria-label="Enviar mensaje"
          >
            Enviar
          </Button>
        </div>
      </form>
    </Can>
  );
}
