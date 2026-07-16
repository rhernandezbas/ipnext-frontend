import { formatRelative } from '@/utils/formatDate';
import type { NewsPost } from '@/types/news';
import styles from './NewsCard.module.css';

interface NewsCardProps {
  post: NewsPost;
  onOpen: (id: string) => void;
}

/**
 * NewsCard (internal-news FE apply, NEWS-FE-BD-2) — tablón item. Native
 * <button> for free click + keyboard (Enter/Space) activation and a real
 * focus-visible ring, instead of a div+onClick+tabIndex reimplementation.
 */
export function NewsCard({ post, onOpen }: NewsCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${!post.read ? styles.cardUnread : ''}`}
      onClick={() => onOpen(post.id)}
    >
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

      <h3 className={styles.title}>{post.title}</h3>
      <p className={styles.excerpt}>{post.body}</p>

      <div className={styles.metaRow}>
        <span className={styles.author}>{post.authorName}</span>
        <span className={styles.dot} aria-hidden="true">·</span>
        <span className={styles.date}>{formatRelative(post.publishedAt)}</span>
      </div>
    </button>
  );
}
