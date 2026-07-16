import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTimeShort } from '@/utils/formatDate';
import { useArchiveNewsPost } from '@/hooks/useNews';
import { useConfirm } from '@/context/ConfirmContext';
import { Can } from '@/components/auth/Can';
import type { NewsPost } from '@/types/news';
import styles from './NewsDetailDrawer.module.css';

/** Elementos tabulables dentro del drawer (para el focus-trap), molde ConfirmModal. */
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

interface NewsDetailDrawerProps {
  post: NewsPost;
  onClose: () => void;
  /** Called exactly once, on mount, when `post.read` is false. */
  onMarkRead: (id: string) => void;
  /** news.manage review fix (M3): opens NewsPostModal in edit mode with this post. */
  onEdit: (post: NewsPost) => void;
}

/**
 * NewsDetailDrawer (internal-news FE apply, NEWS-FE-BD-3) — slide-over panel,
 * portal + focus-trap + Esc, molde `ConfirmModal.tsx`. The caller MUST mount
 * this keyed by `post.id` (lección inbox: sin key, el estado local —acá el
 * guard de mark-read— contamina entre noticias distintas). Body renders as
 * plain `white-space: pre-wrap` text — React already escapes it, no HTML is
 * ever interpreted.
 *
 * Review fix M3: `NewsPostModal` (edit) and `useArchiveNewsPost` existed but
 * were never wired to any trigger — dead code, feature unreachable despite
 * BE support + spec BD-5 ("creación/edición"). "Editar"/"Archivar" live here
 * (gated `news.manage`), acting on the drawer's own post snapshot.
 */
export function NewsDetailDrawer({ post, onClose, onMarkRead, onEdit }: NewsDetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const markedRef = useRef(false);
  const titleId = useId();

  const archiveMutation = useArchiveNewsPost();
  const confirm = useConfirm();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isArchived = !!post.archivedAt;

  async function handleArchive() {
    const nextArchived = !isArchived;
    const ok = await confirm({
      message: nextArchived
        ? `¿Archivar la noticia "${post.title}"? Deja de verse en el tablón activo.`
        : `¿Restaurar la noticia "${post.title}" al tablón activo?`,
      tone: nextArchived ? 'danger' : 'default',
      confirmLabel: nextArchived ? 'Archivar' : 'Restaurar',
    });
    if (!ok) return;
    setFeedback(null);
    try {
      await archiveMutation.mutateAsync({ id: post.id, archived: nextArchived });
      setFeedback({
        type: 'success',
        text: nextArchived ? 'Noticia archivada.' : 'Noticia restaurada al tablón activo.',
      });
    } catch {
      setFeedback({ type: 'error', text: 'No se pudo archivar la noticia. Intentá de nuevo.' });
    }
  }

  // Mark-read: fires once per mount (guarded), only for an unread post. The
  // parent keys this component by post.id, so a NEW post always gets a fresh
  // mount + a fresh markedRef — no cross-post contamination.
  useEffect(() => {
    if (!markedRef.current && !post.read) {
      markedRef.current = true;
      onMarkRead(post.id);
    }
    // Intentionally run once per mount — see component doc above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
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
  }, [onClose]);

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.drawer}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <span className={styles.categoryPill}>
            <span className={styles.categoryDot} style={{ background: post.category.color }} aria-hidden="true" />
            {post.category.name}
          </span>
          {post.pinned && <span className={styles.pinBadge}>Fijada</span>}
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <h2 id={titleId} className={styles.title}>{post.title}</h2>

        <div className={styles.metaRow}>
          <span className={styles.author}>{post.authorName}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDateTimeShort(post.publishedAt)}</span>
        </div>

        <Can permission="news.manage">
          <div className={styles.manageActions}>
            <button type="button" className={styles.actionBtn} onClick={() => onEdit(post)}>
              Editar
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${isArchived ? '' : styles.actionBtnDanger}`}
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Guardando…' : isArchived ? 'Desarchivar' : 'Archivar'}
            </button>
          </div>
          {feedback && (
            <p
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={feedback.type === 'error' ? styles.actionFeedbackError : styles.actionFeedbackSuccess}
            >
              {feedback.text}
            </p>
          )}
        </Can>

        <p className={styles.body}>{post.body}</p>
      </div>
    </div>,
    document.body,
  );
}
