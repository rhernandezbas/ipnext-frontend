import { useState } from 'react';
import { useBroadcastNewsPost } from '@/hooks/useNews';
import { useConfirm } from '@/context/ConfirmContext';
import { mapNewsBroadcastError } from '@/utils/mapNewsError';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './NewsBroadcastButton.module.css';

// ── Inline icons (SVG, never emoji — design-system rule) ──────────────────────

function IconMegaphone() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface Feedback {
  tone: 'success' | 'error';
  text: string;
  link?: string;
}

interface NewsBroadcastButtonProps {
  postId: string;
  /** ISO of the last broadcast, or null. Rendered in Argentina time. */
  lastBroadcastAt: string | null;
}

/**
 * NewsBroadcastButton (N2-FE) — "Difundir al NOC". Confirms softly, POSTs
 * /news/:id/broadcast and reports the result: a success line with the returned
 * deep link, or the BE error mapped by status (503 not-configured, 502 Evolution/Pi,
 * 422 missing public URL). Meant to live inside a `news.manage` gate (parent-gated).
 *
 * The success line uses an SVG check (NOT the ✅ emoji from the ticket copy) to
 * honour the repo's "SVG, never emoji" design-system rule; the wording stays
 * "Difundido al canal — {link}".
 */
export function NewsBroadcastButton({ postId, lastBroadcastAt }: NewsBroadcastButtonProps) {
  const broadcast = useBroadcastNewsPost();
  const confirm = useConfirm();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleBroadcast() {
    if (broadcast.isPending) return;
    const ok = await confirm({
      title: 'Difundir al NOC',
      message: 'Se enviará al canal del NOC por WhatsApp. ¿Confirmás la difusión?',
      confirmLabel: 'Difundir',
    });
    if (!ok) return;
    setFeedback(null);
    try {
      const result = await broadcast.mutateAsync(postId);
      setFeedback({ tone: 'success', text: 'Difundido al canal', link: result.link });
    } catch (err) {
      setFeedback({ tone: 'error', text: mapNewsBroadcastError(err) });
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void handleBroadcast()}
        disabled={broadcast.isPending}
      >
        <IconMegaphone />
        {broadcast.isPending ? 'Difundiendo…' : 'Difundir al NOC'}
      </button>

      {lastBroadcastAt && (
        <p className={styles.lastBroadcast}>Difundida el {formatDateTimeShort(lastBroadcastAt)}</p>
      )}

      {feedback?.tone === 'success' && (
        <p className={styles.feedbackSuccess} role="status" aria-live="polite">
          <span className={styles.checkIcon} aria-hidden="true">
            <IconCheck />
          </span>
          {feedback.text}
          {feedback.link && (
            <>
              {' — '}
              <a href={feedback.link} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {feedback.link}
              </a>
            </>
          )}
        </p>
      )}

      {feedback?.tone === 'error' && (
        <p className={styles.feedbackError} role="alert">
          {feedback.text}
        </p>
      )}
    </div>
  );
}
