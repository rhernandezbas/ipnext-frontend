import { useState } from 'react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from '@/hooks/useNotifications';
import type { Notification } from '@/types/notification';
import styles from './NotificationsPage.module.css';

type Filter = 'all' | 'unread';

const SEVERITY_ICON: Record<string, string> = {
  error: '',
  warning: '',
  success: '',
  info: 'i',
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');

  const { data: allNotifications = [], isLoading } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const { mutate: deleteNotif } = useDeleteNotification();

  const displayed: Notification[] = filter === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

  const unreadCount = allNotifications.filter(n => !n.read).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notificaciones</h1>
        <button
          type="button"
          className={styles.markAllBtn}
          onClick={() => markAllRead()}
          disabled={unreadCount === 0}
        >
          Marcar todas como leidas
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({allNotifications.length})
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'unread' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('unread')}
        >
          Sin leer ({unreadCount})
        </button>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <p className={styles.loading}>Cargando...</p>
      ) : displayed.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay notificaciones</p>
        </div>
      ) : (
        <div className={styles.list}>
          {displayed.map(notif => (
            <div
              key={notif.id}
              className={`${styles.item} ${!notif.read ? styles.itemUnread : ''}`}
            >
              <span className={styles.severityIcon}>
                {SEVERITY_ICON[notif.severity] ?? 'i'}
              </span>
              <div className={styles.content}>
                <div className={styles.itemHeader}>
                  <p className={styles.itemTitle}>{notif.title}</p>
                  <span className={styles.itemTime}>{formatRelative(notif.createdAt)}</span>
                </div>
                <p className={styles.itemMessage}>{notif.message}</p>
              </div>
              {!notif.read && <span className={styles.unreadIndicator} aria-label="Sin leer" />}
              <div className={styles.itemActions}>
                {!notif.read && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => markRead(notif.id)}
                  >
                    Marcar como leida
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => deleteNotif(notif.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
