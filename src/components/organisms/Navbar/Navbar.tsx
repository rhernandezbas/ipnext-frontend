import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSearch } from '@/hooks/useSearch';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import type { SearchResult } from '@/types/search';
import styles from './Navbar.module.css';

const SECTION_TITLES: Record<string, string> = {
  '/admin/customers/list': 'Clientes',
  '/admin/tickets': 'Tickets',
  '/admin/finance': 'Finanzas',
  '/admin/customers/view': 'Detalle de Cliente',
  '/admin/tickets/opened': 'Lista de Tickets',
  '/admin/tickets/trash': 'Archivo de Tickets',
  '/admin/tickets/new': 'Nuevo Ticket',
  '/admin/finance/invoices': 'Facturas',
  '/admin/finance/payments': 'Pagos',
  '/admin/finance/transactions': 'Transacciones',
};

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function severityIcon(severity: string): string {
  if (severity === 'error') return '';
  if (severity === 'warning') return '';
  if (severity === 'success') return '';
  return 'i';
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

const TYPE_LABELS: Record<string, string> = {
  client: 'Clientes',
  ticket: 'Tickets',
  invoice: 'Facturas',
  device: 'Dispositivos',
  lead: 'Leads',
  admin: 'Administradores',
};

export function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const sectionTitle = SECTION_TITLES[pathname] ?? 'Administración';
  const initials = user ? getInitials(user.displayName) : '?';

  const handleLogout = () => {
    void logout();
  };

  // ── Search ─────────────────────────────────────────────────────────────
  const { query, setQuery, results, showResults, closeResults } = useSearch(300);
  const searchRef = useRef<HTMLDivElement>(null);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      closeResults();
    } else if (e.key === 'Enter' && results.length > 0) {
      const first = results[0];
      if (first) {
        closeResults();
        navigate(first.href);
      }
    }
  }

  function handleResultClick(result: SearchResult) {
    closeResults();
    setQuery('');
    navigate(result.href);
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // ── Notifications ──────────────────────────────────────────────────────
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter(n => !n.read).length;

  function handleNotifClick(id: string, link: string | null) {
    markRead(id);
    setShowNotifications(false);
    if (link) navigate(link);
  }

  // ── Click outside handlers ─────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeResults();
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeResults]);

  return (
    <header className={styles.navbar}>
      <span className={styles.sectionTitle}>{sectionTitle}</span>

      {/* Search */}
      <div className={styles.searchBar} ref={searchRef}>
        <input
          type="text"
          placeholder="Buscar..."
          className={styles.searchInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-label="Buscar"
          aria-autocomplete="list"
          aria-expanded={showResults}
        />
        {showResults && (
          <div className={styles.searchDropdown} role="listbox">
            {results.length === 0 ? (
              <p className={styles.searchEmpty}>Sin resultados para &ldquo;{query}&rdquo;</p>
            ) : (
              <>
                {Object.entries(grouped).map(([type, items]) => (
                  <div key={type} className={styles.searchResultGroup}>
                    <p className={styles.searchGroupLabel}>{TYPE_LABELS[type] ?? type}</p>
                    {items.map(result => (
                      <button
                        key={result.id}
                        className={styles.searchResult}
                        role="option"
                        aria-selected={false}
                        onClick={() => handleResultClick(result)}
                      >
                        <span className={styles.searchResultIcon}>{result.icon}</span>
                        <div className={styles.searchResultText}>
                          <span className={styles.searchResultTitle}>{result.title}</span>
                          <span className={styles.searchResultSubtitle}>{result.subtitle}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
                <div className={styles.searchFooter}>
                  <button className={styles.searchSeeAll} onClick={() => closeResults()}>
                    Ver todos los resultados
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {/* Notifications bell */}
        <div className={styles.notifWrapper} ref={notifRef}>
          <button
            type="button"
            role="button"
            aria-label="Notificaciones"
            className={styles.actionBtn}
            onClick={() => setShowNotifications(v => !v)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className={styles.notifBadge} aria-label={`${unreadCount} notificaciones sin leer`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifHeader}>
                <span className={styles.notifHeaderTitle}>Notificaciones</span>
                <button
                  type="button"
                  className={styles.markAllBtn}
                  onClick={() => markAllRead()}
                >
                  Marcar todas como leidas
                </button>
              </div>
              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <p className={styles.notifEmpty}>Sin notificaciones</p>
                ) : (
                  notifications.map(notif => (
                    <button
                      key={notif.id}
                      className={`${styles.notifItem} ${!notif.read ? styles.notifItemUnread : ''}`}
                      onClick={() => handleNotifClick(notif.id, notif.link)}
                    >
                      <span className={styles.notifSeverityIcon}>{severityIcon(notif.severity)}</span>
                      <div className={styles.notifContent}>
                        <p className={styles.notifTitle}>{notif.title}</p>
                        <p className={styles.notifMessage}>{notif.message.slice(0, 60)}{notif.message.length > 60 ? '...' : ''}</p>
                        <p className={styles.notifTime}>{formatRelative(notif.createdAt)}</p>
                      </div>
                      {!notif.read && <span className={styles.notifUnreadDot} aria-label="No leida" />}
                    </button>
                  ))
                )}
              </div>
              <div className={styles.notifFooter}>
                <button
                  className={styles.notifSeeAll}
                  onClick={() => { setShowNotifications(false); navigate('/admin/notifications'); }}
                >
                  Ver todas las notificaciones
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          role="button"
          aria-label="Agregar"
          className={styles.actionBtn}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <div className={styles.userArea}>
          <button
            type="button"
            className={styles.avatar}
            title={user?.displayName}
            onClick={() => navigate('/admin/profile')}
            aria-label="Ver perfil"
          >
            {initials}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout} type="button">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
