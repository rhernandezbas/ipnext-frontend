import { useRadiusEvents } from '@/hooks/useRadiusEvents';
import { useRadiusLogsFilterUrl } from './hooks/useRadiusLogsFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './RadiusLogsPage.module.css';

// ── Inline formatters ──────────────────────────────────────────────────────────

function formatBytes(octets: string): string {
  try {
    const bytes = BigInt(octets);
    if (bytes < BigInt(1024)) return `${bytes} B`;
    if (bytes < BigInt(1024 * 1024)) return `${(Number(bytes) / 1024).toFixed(1)} KB`;
    if (bytes < BigInt(1024 * 1024 * 1024)) return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
    return `${(Number(bytes) / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } catch {
    return octets;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

export default function RadiusLogsPage() {
  const { filter, setFilter, clearFilter } = useRadiusLogsFilterUrl();
  const page = filter.page ?? 1;

  const queryParams = {
    username:  filter.username  || undefined,
    nasId:     filter.nasId     || undefined,
    vlanId:    filter.vlanId    || undefined,
    eventType: filter.eventType || undefined,
    online:    filter.online === 'true' ? true : filter.online === 'false' ? false : undefined,
    from:      filter.from      || undefined,
    to:        filter.to        || undefined,
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useRadiusEvents(queryParams);

  // usar el limit que devuelve el BE (lo capa a MAX_LIMIT=200) en vez del LIMIT local
  const totalPages = data ? Math.ceil(data.total / (data.limit || LIMIT)) : 1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Logs RADIUS</h1>
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
        <input
          type="text"
          className={styles.input}
          placeholder="NAS ID"
          value={filter.nasId ?? ''}
          onChange={(e) => setFilter({ nasId: e.target.value || undefined, page: 1 })}
          aria-label="Filtrar por NAS ID"
        />
        <input
          type="text"
          className={styles.input}
          placeholder="VLAN ID"
          value={filter.vlanId ?? ''}
          onChange={(e) => setFilter({ vlanId: e.target.value || undefined, page: 1 })}
          aria-label="Filtrar por VLAN ID"
        />
        <select
          className={styles.select}
          value={filter.eventType ?? ''}
          onChange={(e) => setFilter({ eventType: e.target.value as typeof filter.eventType, page: 1 })}
          aria-label="Filtrar por tipo de evento"
        >
          <option value="">Todos los eventos</option>
          <option value="start">start</option>
          <option value="stop">stop</option>
          <option value="interim">interim</option>
        </select>
        <select
          className={styles.select}
          value={filter.online ?? ''}
          onChange={(e) => setFilter({ online: e.target.value as typeof filter.online, page: 1 })}
          aria-label="Filtrar por estado online"
        >
          <option value="">Todos</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        <input
          type="date"
          className={styles.input}
          value={filter.from ?? ''}
          onChange={(e) => setFilter({ from: e.target.value || undefined, page: 1 })}
          aria-label="Desde"
          title="Desde"
        />
        <input
          type="date"
          className={styles.input}
          value={filter.to ?? ''}
          onChange={(e) => setFilter({ to: e.target.value || undefined, page: 1 })}
          aria-label="Hasta"
          title="Hasta"
        />
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
              <th>NAS</th>
              <th>IP</th>
              <th>MAC</th>
              <th>VLAN</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Duración</th>
              <th>Estado</th>
              <th>Tráfico entrada</th>
              <th>Tráfico salida</th>
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
                  Error al cargar los eventos
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.length === 0 && (
              <tr>
                <td colSpan={11} className={styles.stateCell}>
                  No hay eventos RADIUS
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.map((evt) => (
              <tr key={evt.id}>
                <td className={styles.mono}>{evt.username}</td>
                <td>{evt.nasName ?? evt.nasIpAddress}</td>
                <td className={styles.mono}>{evt.framedIp ?? '—'}</td>
                <td className={styles.mono}>{evt.macAddress ?? '—'}</td>
                <td>{evt.vlanId ?? '—'}</td>
                <td>{formatDateTimeShort(evt.startedAt)}</td>
                <td>{evt.stoppedAt ? formatDateTimeShort(evt.stoppedAt) : '—'}</td>
                <td className={styles.mono}>{formatDuration(evt.sessionTimeSeconds)}</td>
                <td>
                  {evt.online ? (
                    <span className={styles.badgeOnline}>Online</span>
                  ) : (
                    <span className={styles.badgeClosed}>Cerrada</span>
                  )}
                </td>
                <td>{formatBytes(evt.inOctets)}</td>
                <td>{formatBytes(evt.outOctets)}</td>
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
