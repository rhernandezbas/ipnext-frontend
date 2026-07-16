import { formatRelative } from '@/utils/formatDate';
import type { NewsPost } from '@/types/news';
import styles from './NewsCard.module.css';

interface NewsCardProps {
  post: NewsPost;
  onOpen: (id: string) => void;
}

/**
 * NewsCard (internal-news FE apply, NEWS-FE-BD-2 — review fix M2) — tablón
 * item. A `<button>` cannot legally wrap flow content like `<h3>`/`<p>`
 * (phrasing-content-only children per the HTML spec) — screen readers then
 * collapse the whole card to one accessible name and the h3 stops being a
 * navigable heading landmark. Fix: `<article>` root with a REAL `<h3>`
 * heading, and the click/keyboard trigger is a `<button>` scoped to just the
 * title text, stretched over the full card via `::after` (the classic
 * "stretched link" card pattern — see NewsCard.module.css `.titleButton`).
 * Net result: heading navigable by SR, short accessible name (the title
 * only, not the whole card), full-card click/touch target, real
 * focus-visible ring on the card boundary.
 */
export function NewsCard({ post, onOpen }: NewsCardProps) {
  return (
    <article className={`${styles.card} ${!post.read ? styles.cardUnread : ''}`}>
      <div className={styles.topRow}>
        {/*
          The category color is arbitrary BE data (any hex a news.manage user
          picks) — it can't be used as TEXT color against a tint of itself
          without computing per-color contrast at runtime. Same convention as
          TicketAreasBody: the color is a decorative swatch dot only; the name
          renders in the normal neutral text color, so contrast is guaranteed
          regardless of which color is chosen.
        */}
        <span className={styles.categoryPill}>
          <span className={styles.categoryDot} style={{ background: post.category.color }} aria-hidden="true" />
          {post.category.name}
        </span>

        {post.pinned && (
          <span className={styles.pinBadge} aria-label="Noticia fijada">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16 3l5 5-5.5 5.5L17 18l-1 1-4.5-4.5L6 20l-2-2 5.5-5.5L5 8l1-1 4.5 4.5L16 3z" />
            </svg>
            Fijada
          </span>
        )}

        {!post.read && <span className={styles.unreadDot} aria-label="No leída" />}
      </div>

      <h3 className={styles.title}>
        <button type="button" className={styles.titleButton} onClick={() => onOpen(post.id)}>
          {post.title}
        </button>
      </h3>
      <p className={styles.excerpt}>{post.body}</p>

      <div className={styles.metaRow}>
        <span className={styles.author}>{post.authorName}</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span className={styles.date}>{formatRelative(post.publishedAt)}</span>
      </div>
    </article>
  );
}
