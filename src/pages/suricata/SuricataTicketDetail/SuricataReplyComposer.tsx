import { useEffect, useRef, useState } from 'react';
import { useCan } from '@/hooks/useMyPermissions';
import { Button } from '@/components/atoms/Button/Button';
import { useReplySuricataTicket } from '../hooks/useSuricataTickets';
import { computeSuricataReplyConfirmation } from '../utils/suricataReplyConfirmation';
import { mapSuricataReplyError } from '../utils/mapSuricataReplyError';
import { SuricataReplyConfirmModal } from './SuricataReplyConfirmModal';
import styles from './SuricataReplyComposer.module.css';

interface Props {
  ticketId: string;
  customerName: string | null;
  customerPhone: string | null;
  ticketSubject: string;
  ticketExternalId: string;
}

/**
 * SuricataReplyComposer — Fase I, tasks I.1/I.3, spec `suricata-ticket-reply`
 * REPLY-1..6, design D10. Lives at the foot of `SuricataConversationTab`
 * (design D13.a). RBAC gate (UI-8/REPLY-1): per this apply session's explicit
 * instruction the composer is HIDDEN (not just disabled) without
 * `suricata.reply` — a deliberate deviation from task I.1's literal
 * "button disabled (not hidden)" wording, flagged in the apply report.
 *
 * Flow (REPLY-2's two explicit confirmations):
 *   1. Operator types the text and submits the form ("Responder al cliente")
 *      — this is confirmation #1, and it opens the modal with the exact text
 *      frozen (the textarea is disabled while the modal is open, so what the
 *      modal shows can never drift from what gets sent).
 *   2. Operator clicks "Sí, enviar ahora" inside the modal — confirmation #2
 *      — which computes `sha256(body)` client-side and sends `{body, confirm}`.
 *      The BE recomputes and compares; a mismatch is rejected before touching
 *      anything (REPLY-2).
 *
 * On failure the modal STAYS open with an inline, honest error (REPLY-5) —
 * today that is ALWAYS `SURICATA_UNAVAILABLE` (502), because Phase E wires
 * `UnavailableSuricataReplyPort` unconditionally until Phase J's Playwright
 * sidecar lands. This composer never shows a false "enviado".
 */
export function SuricataReplyComposer({ ticketId, customerName, customerPhone, ticketSubject, ticketExternalId }: Props) {
  const canReply = useCan('suricata.reply');
  const replyMutation = useReplySuricataTicket(ticketId);

  const [body, setBody] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The modal restores focus to whatever opened it. After a SUCCESSFUL send the
  // body is cleared, so that trigger ("Responder al cliente") is `disabled` and
  // `focus()` on it does nothing — focus silently fell to <body>. The textarea
  // is always enabled once the modal is closed and is where the operator would
  // continue anyway, so the composer claims focus back explicitly. This effect
  // runs after the modal's unmount cleanup, so it wins the race.
  useEffect(() => {
    if (!restoreFocus) return;
    textareaRef.current?.focus();
    setRestoreFocus(false);
  }, [restoreFocus]);

  if (!canReply) return null;

  const trimmed = body.trim();
  const canOpenModal = trimmed.length > 0 && !replyMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canOpenModal) return;
    setError(null);
    setFeedback(null);
    setModalOpen(true);
  }

  async function handleConfirm() {
    setError(null);
    try {
      const confirm = await computeSuricataReplyConfirmation(trimmed);
      await replyMutation.mutateAsync({ body: trimmed, confirm });
      setModalOpen(false);
      setBody('');
      setFeedback('Respuesta enviada. El intento quedó registrado en la auditoría.');
      setRestoreFocus(true);
    } catch (err) {
      // REPLY-5 — the modal stays open so the operator sees the failure
      // in the SAME context (recipient/ticket/text still visible), instead
      // of silently closing on error.
      setError(mapSuricataReplyError(err));
    }
  }

  function handleCancelModal() {
    if (replyMutation.isPending) return;
    setModalOpen(false);
    setError(null);
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} aria-label="Responder al cliente en Suricata">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Responder al cliente</span>
        <span className={styles.headerWarning}>
          Esto dispara una acción REAL sobre Suricata: el mensaje se envía de verdad y no se puede editar ni
          borrar después.
        </span>
      </header>

      <label className={styles.srOnly} htmlFor="suricata-reply-body">
        Respuesta para el cliente
      </label>
      <textarea
        ref={textareaRef}
        id="suricata-reply-body"
        className={styles.textarea}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (feedback) setFeedback(null);
        }}
        placeholder="Escribí la respuesta que se va a enviar al cliente…"
        disabled={modalOpen || replyMutation.isPending}
      />

      {feedback && (
        <p className={styles.success} role="status" aria-live="polite">
          {feedback}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="md" disabled={!canOpenModal}>
          Responder al cliente
        </Button>
      </div>

      <SuricataReplyConfirmModal
        open={modalOpen}
        busy={replyMutation.isPending}
        error={error}
        customerName={customerName}
        customerPhone={customerPhone}
        ticketSubject={ticketSubject}
        ticketExternalId={ticketExternalId}
        body={trimmed}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancelModal}
      />
    </form>
  );
}
