import { useTaskActivity } from '@/hooks/useTaskActivity';
import { describeActivity } from './taskActivityLabel';
import type { ActivityDto } from '@/types/taskActivity';
import styles from './TaskActivityFeed.module.css';

function initials(name: string): string {
  return (
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
  );
}

function ActivityItem({ a }: { a: ActivityDto }) {
  return (
    <div className={styles.item}>
      <span className={styles.avatar} aria-hidden>{initials(a.actorName)}</span>
      <div className={styles.body}>
        <p className={styles.line}>
          <span className={styles.actor}>{a.actorName}</span>{' '}
          <span className={styles.action}>{describeActivity(a)}</span>
        </p>
        <time className={styles.date} dateTime={a.createdAt}>
          {new Date(a.createdAt).toLocaleString('es-AR')}
        </time>
      </div>
    </div>
  );
}

/**
 * Read-only task activity feed (#10). Consumes GET /api/scheduling/:id/activity
 * with cursor pagination; mirrors the TaskAuditFeed pattern. Each entry shows the
 * actor, a human-readable action, and the timestamp. Newest-first.
 */
export function TaskActivityFeed({ taskId }: { taskId: string }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTaskActivity(taskId);

  if (isLoading) return <p className={styles.muted}>Cargando actividad…</p>;
  if (isError) return <p className={styles.muted}>No se pudo cargar la actividad.</p>;

  const items = (data?.pages ?? []).flatMap(p => p.items);
  if (items.length === 0) {
    return <p className={styles.muted}>Sin actividad registrada todavía.</p>;
  }

  return (
    <div className={styles.feed}>
      {items.map(a => (
        <ActivityItem key={a.id} a={a} />
      ))}
      {hasNextPage && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </div>
  );
}
