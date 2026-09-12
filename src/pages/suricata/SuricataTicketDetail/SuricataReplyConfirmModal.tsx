import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './SuricataReplyConfirmModal.module.css';

/** Molde `ConfirmModal.tsx`'s focus-trap — duplicated on purpose: this is a
 *  DEDICATED, richer modal (recipient + ticket + exact text), not a generic
 *  `useConfirm()` message, so it cannot reuse that component directly. Same
 *  criterion already used for `SuricataTicketDetailPage`'s local
 *  `BOT_STATE_LABEL` duplication (Fase H) — editing a prior phase's shared
 *  file for a one-off need was rejected there too. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

interface Props {
  open: boolean;
  busy: boolean;
  /** Non-null → an inline `role="alert"` banner inside the dialog (REPLY-5 — no silent failure). */
  error: string | null;
  customerName: string | null;
  customerPhone: string | null;
  ticketSubject: string;
  ticketExternalId: string;
  /** The EXACT text that will be sent — shown verbatim, never a re-derived summary. */
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * SuricataReplyConfirmModal — Fase I, tasks I.1/I.3, spec `suricata-ticket-reply`
 * REPLY-2/REPLY-5, design D10. This is the SECOND of the two explicit
 * confirmation steps REPLY-2 requires (the first is the composer's "Responder
 * al cliente" submit, which opens this dialog). Unlike the generic
 * `ConfirmModal`, this ALWAYS shows the recipient (name + phone) and the
 * ticket being replied to, plus the exact final text — "doble confirmación
 * real" per the task brief, not just a repeated Yes/No.
 *
 * A11y: portal + `role="dialog"`/`aria-modal`, Escape cancels (unless busy),
 * backdrop click cancels (unless busy), Tab/Shift+Tab trap focus inside,
 * initial focus goes to Cancelar (irreversible/high-risk action — same "safe
 * default" criterion `ConfirmModal` uses for `tone="danger"`), focus restores
 * to the trigger on close.
 */
export function SuricataReplyConfirmModal({
  open,
  busy,
  error,
  customerName,
  customerPhone,
  ticketSubject,
  ticketExternalId,
  body,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (busy) return;
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.current?.contains(active);
      if (e.shiftKey) {
        if (active === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || outside) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suricata-reply-confirm-title"
    >
      <div className={styles.dialog} ref={dialogRef}>
        <h2 id="suricata-reply-confirm-title" className={styles.title}>
          Confirmar envío a Suricata
        </h2>
        <p className={styles.warning}>
          Esta acción es REAL e irreversible: el mensaje se envía de verdad a Suricata y no se puede editar ni
          borrar después.
        </p>

        <dl className={styles.factList}>
          <div className={styles.factRow}>
            <dt className={styles.factLabel}>Destinatario</dt>
            <dd className={styles.factValue}>
              {customerName ?? 'Sin nombre en el mirror'}
              {customerPhone && <span className={styles.factSecondary}> · {customerPhone}</span>}
            </dd>
          </div>
          <div className={styles.factRow}>
            <dt className={styles.factLabel}>Ticket</dt>
            <dd className={styles.factValue}>
              #{ticketExternalId} · {ticketSubject}
            </dd>
          </div>
        </dl>

        <div className={styles.bodyPreview}>
          <span className={styles.bodyPreviewLabel}>Texto que se va a enviar</span>
          <p className={styles.bodyPreviewText}>{body}</p>
        </div>

        {error && (
          <p className={styles.error} role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Enviando (Playwright)...' : 'Sí, enviar ahora'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
