import { useNe8000Audit } from '@/hooks/useNe8000Audit';
import { useNe8000AuditFilterUrl } from './hooks/useNe8000AuditFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './Ne8000AuditPage.module.css';

// ── Component ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

export default function Ne8000AuditPage() {
  const { filter, setFilter, clearFilter } = useNe8000AuditFilterUrl();
  const page = filter.page ?? 1;

  const queryParams = {
    username:      filter.username      || undefined,
    status:        filter.status        || undefined,
    enforcedState: filter.enforcedState || undefined,
    online:        filter.online === 'true' ? true : filter.online === 'false' ? false : undefined,
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useNe8000Audit(queryParams);

  // usar el limit que devuelve el BE (lo capa a MAX_LIMIT=200) en vez del LIMIT local
  const totalPages = data ? Math.ceil(data.total / (data.limit || LIMIT)) : 1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Auditoría NE8000</h1>
        {data && (
          <span className={styles.badge}>{data.total}</span>
        )}
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.input}
          placeholder="Username"
          value={filter.username ?? ''}
          onChange={(e) => setFilter({ username: e.target.value || undefined, page: 1 })}
          aria-label="Filtrar por username"
        />
        <select
          className={styles.select}
          value={filter.status ?? ''}
          onChange={(e) => setFilter({ status: e.target.value as typeof filter.status, page: 1 })}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="enabled">enabled</option>
          <option value="disabled">disabled</option>
        </select>
        <select
          className={styles.select}
          value={filter.enforcedState ?? ''}
          onChange={(e) => setFilter({ enforcedState: e.target.value as typeof filter.enforcedState, page: 1 })}
          aria-label="Filtrar por enforcement"
        >
          <option value="">Todos</option>
          <option value="active">active</option>
          <option value="reduced">reduced</option>
          <option value="blocked">blocked</option>
        </select>
        <select
          className={styles.select}
          value={filter.online ?? ''}
          onChange={(e) => setFilter({ online: e.target.value as typeof filter.online, page: 1 })}
          aria-label="Filtrar por online"
        >
          <option value="">Todos</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        <button
          type="button"
          className={styles.btnClear}
          onClick={clearFilter}
        >
          Limpiar
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Plan</th>
              <th>IP</th>
              <th>MAC</th>
              <th>Estado</th>
              <th>Enforcement</th>
              <th>Contrato</th>
              <th>Online</th>
              <th>Última sesión</th>
              <th>IP dinámica</th>
              <th>VLAN</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className={styles.stateCell}>
                  <span className={styles.spinner} aria-label="Cargando" />
                  Cargando...
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td colSpan={11} className={styles.stateCell}>
                  Error al cargar la auditoría
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.length === 0 && (
              <tr>
                <td colSpan={11} className={styles.stateCell}>
                  No hay registros
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.map((row) => (
              <tr key={row.pppoeId}>
                <td className={styles.mono}>{row.username}</td>
                <td>{row.profile ?? '—'}</td>
                <td className={styles.mono}>{row.remoteAddress ?? '—'}</td>
                <td className={styles.mono}>{row.macAddress ?? '—'}</td>
                <td>
                  {row.status === 'enabled' ? (
                    <span className={styles.badgeEnabled}>enabled</span>
                  ) : (
                    <span className={styles.badgeDisabled}>disabled</span>
                  )}
                </td>
                <td>
                  {row.enforcedState === 'active' && (
                    <span className={styles.enforcedActive}>active</span>
                  )}
                  {row.enforcedState === 'reduced' && (
                    <span className={styles.enforcedReduced}>reduced</span>
                  )}
                  {row.enforcedState === 'blocked' && (
                    <span className={styles.enforcedBlocked}>blocked</span>
                  )}
                  {row.enforcedState !== 'active' && row.enforcedState !== 'reduced' && row.enforcedState !== 'blocked' && (
                    <span className={styles.enforcedOther}>{row.enforcedState}</span>
                  )}
                </td>
                <td className={styles.mono}>{row.contractId ?? '—'}</td>
                <td>
                  {row.currentlyOnline ? (
                    <span className={styles.badgeOnline}>Online</span>
                  ) : (
                    <span className={styles.badgeOffline}>Offline</span>
                  )}
                </td>
                <td>{row.lastStartedAt ? formatDateTimeShort(row.lastStartedAt) : '—'}</td>
                <td className={styles.mono}>{row.lastFramedIp ?? '—'}</td>
                <td>{row.lastVlanId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className={styles.paginationWrapper}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setFilter({ page: p })}
          />
        </div>
      )}
    </div>
  );
}
