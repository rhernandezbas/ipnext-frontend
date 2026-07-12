import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { useSendWhatsappMessage } from '@/hooks/useWhatsapp';
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

/** Copy legible por `code` (`errorHandler.ts`, design §3) — fallback al `error` crudo del BE, y de ahí a un genérico. */
const ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  MESSAGING_WINDOW_EXPIRED: 'La ventana de 24 horas expiró. Se necesita una plantilla para reabrir la conversación.',
  CHATWOOT_UNAVAILABLE: 'El servicio de mensajería no está disponible en este momento. Intentá de nuevo en unos minutos.',
  CONVERSATION_NOT_FOUND: 'Esta conversación ya no existe.',
};

function resolveErrorMessage(error: unknown): string {
  const shaped = error as { response?: { data?: { error?: string; code?: string } } } | null | undefined;
  const code = shaped?.response?.data?.code;
  if (code && ERROR_MESSAGES_BY_CODE[code]) return ERROR_MESSAGES_BY_CODE[code];
  const raw = shaped?.response?.data?.error;
  if (raw) return raw;
  return 'No se pudo enviar el mensaje. Intentá de nuevo.';
}

/**
 * Composer — textarea + botón de envío (messaging-inbox F1, design §1/§6,
 * COMPOSER-1). `canReply` llega resuelto como prop (design §1: la page
 * orquesta `useWhatsappConversation`); la mutation de envío es DUEÑA acá
 * (`useSendWhatsappMessage`, molde react-query: la mutation vive junto al
 * widget que la dispara, no prop-drilleada desde arriba).
 *
 * 422 (`MESSAGING_WINDOW_EXPIRED`) / 503 (`CHATWOOT_UNAVAILABLE`): NO se
 * manejan con try/catch — se leen reactivamente de `mutation.isError` /
 * `mutation.error`, que el hook (FB1, `useWhatsapp.ts`) ya captura en su
 * `onError` sin relanzar (el interceptor global de axios solo cubre 401).
 */
export function Composer({ conversationId, canReply, isDetailLoading = false, isDetailError = false }: ComposerProps) {
  const [content, setContent] = useState('');
  const mutation = useSendWhatsappMessage(conversationId);

  const trimmed = content.trim();
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
  const disabled = isDetailLoading || !canReply || mutation.isPending;

  function trySend() {
    if (!trimmed || disabled) return;
    mutation.mutate(trimmed, { onSuccess: () => setContent('') });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    trySend();
  }

  // Bug #11 (polish, post-review-adversarial): Enter envía, Shift+Enter hace
  // un salto de línea normal (no se llama preventDefault en ese caso — el
  // textarea inserta el \n por su cuenta).
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
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

        {mutation.isError && (
          <p className={styles.error} role="alert">
            {resolveErrorMessage(mutation.error)}
          </p>
        )}

        <div className={styles.row}>
          <label className={styles.srOnly} htmlFor="whatsapp-composer-input">
            Mensaje
          </label>
          <textarea
            id="whatsapp-composer-input"
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje…"
            disabled={disabled}
          />
          <Button
            type="submit"
            variant="primary"
            className={styles.sendButton}
            disabled={disabled || !trimmed}
            loading={mutation.isPending}
            aria-label="Enviar mensaje"
          >
            Enviar
          </Button>
        </div>
      </form>
    </Can>
  );
}
