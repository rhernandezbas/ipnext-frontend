import { Link } from 'react-router-dom';
import { useDashboardStats, useDashboardShortcuts, useRecentActivity } from '@/hooks/useDashboard';
import type { RecentActivity } from '@/types/dashboard';
import styles from './DashboardPage.module.css';

function getActivityIcon(type: RecentActivity['type']): string {
  const icons: Record<RecentActivity['type'], string> = {
    client_added: '👤',
    ticket_opened: '🎫',
    invoice_paid: '💰',
    device_offline: '📡',
    payment_received: '💰',
  };
  return icons[type];
}

function getRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days !== 1 ? 's' : ''}`;
}

function getProgressColor(value: number): string {
  if (value >= 80) return '#ef4444';
  if (value >= 60) return '#f59e0b';
  return '#10b981';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buen día';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: shortcuts = [] } = useDashboardShortcuts();
  const { data: activity = [] } = useRecentActivity();

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de control</h1>
          <p className={styles.greeting}>{getGreeting()}, Admin &mdash; {today}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid} aria-label="KPI cards">
        {statsLoading ? (
          <>
            <div className={`${styles.kpiCard} ${styles.skeleton} ${styles.skeletonCard}`} />
            <div className={`${styles.kpiCard} ${styles.skeleton} ${styles.skeletonCard}`} />
            <div className={`${styles.kpiCard} ${styles.skeleton} ${styles.skeletonCard}`} />
            <div className={`${styles.kpiCard} ${styles.skeleton} ${styles.skeletonCard}`} />
          </>
        ) : stats ? (
          <>
            <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
              <p className={styles.kpiValue}>{stats.activeClients.toLocaleString('es-AR')}</p>
              <p className={styles.kpiLabel}>Clientes online</p>
            </div>
            <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
              <p className={styles.kpiValue}>{stats.newClientsThisMonth.toLocaleString('es-AR')}</p>
              <p className={styles.kpiLabel}>Clientes nuevos</p>
            </div>
            <div className={styles.kpiCard} style={{ '--kpi-color': '#f59e0b' } as React.CSSProperties}>
              <p className={styles.kpiValue}>{stats.openTickets}</p>
              <p className={styles.kpiLabel}>Tickets nuevos/abiertos</p>
            </div>
            <div className={styles.kpiCard} style={{ '--kpi-color': '#ef4444' } as React.CSSProperties}>
              <p className={styles.kpiValue}>{stats.unresponsiveDevices}</p>
              <p className={styles.kpiLabel}>Dispositivos sin respuesta</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Main row: activity + system resources */}
      <div className={styles.mainRow}>
        {/* Recent activity */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Actividad reciente</h2>
          <div className={styles.activityList} aria-label="Recent activity feed">
            {activity.map(item => (
              <div key={item.id} className={styles.activityItem}>
                <span className={styles.activityIcon}>{getActivityIcon(item.type)}</span>
                <div className={styles.activityBody}>
                  <p className={styles.activityDesc}>{item.description}</p>
                  <p className={styles.activityTime}>{getRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System resources */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Recursos del sistema</h2>
          {stats ? (
            <div className={styles.resourceList}>
              <div className={styles.resourceItem}>
                <div className={styles.resourceHeader}>
                  <span className={styles.resourceLabel}>CPU</span>
                  <span className={styles.resourceValue}>{stats.cpuUsage}%</span>
                </div>
                <div className={styles.progressBar} aria-label="CPU usage progress bar">
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${stats.cpuUsage}%`,
                      '--progress-color': getProgressColor(stats.cpuUsage),
                    } as React.CSSProperties}
                  />
                </div>
              </div>
              <div className={styles.resourceItem}>
                <div className={styles.resourceHeader}>
                  <span className={styles.resourceLabel}>RAM</span>
                  <span className={styles.resourceValue}>{stats.ramUsage}%</span>
                </div>
                <div className={styles.progressBar} aria-label="RAM usage">
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${stats.ramUsage}%`,
                      '--progress-color': getProgressColor(stats.ramUsage),
                    } as React.CSSProperties}
                  />
                </div>
              </div>
              <div className={styles.resourceItem}>
                <div className={styles.resourceHeader}>
                  <span className={styles.resourceLabel}>Disco</span>
                  <span className={styles.resourceValue}>{stats.diskUsage}%</span>
                </div>
                <div className={styles.progressBar} aria-label="Disk usage">
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${stats.diskUsage}%`,
                      '--progress-color': getProgressColor(stats.diskUsage),
                    } as React.CSSProperties}
                  />
                </div>
              </div>
              <p className={styles.uptime}>
                Uptime: <span className={styles.uptimeValue}>{stats.uptime}</span>
              </p>
            </div>
          ) : statsLoading ? (
            <div className={`${styles.skeleton}`} style={{ height: '120px' }} />
          ) : null}
        </div>
      </div>

      {/* Shortcuts */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Acceso rápido</h2>
        <div className={styles.shortcutsGrid} aria-label="Quick access shortcuts">
          {shortcuts.map(s => (
            <Link
              key={s.id}
              to={s.href}
              className={styles.shortcutBtn}
              style={{ '--shortcut-color': s.color } as React.CSSProperties}
            >
              <span className={styles.shortcutIcon}>{s.icon}</span>
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
