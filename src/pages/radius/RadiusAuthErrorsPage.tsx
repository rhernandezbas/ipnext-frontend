import { useRadiusAuthFailures } from '@/hooks/useRadiusAuthFailures';
import { useAuthFailuresFilterUrl } from './hooks/useAuthFailuresFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { RadiusAuthReply } from '@/types/networkAudit';
import styles from './RadiusAuthErrorsPage.module.css';

// ── Component ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

/**
 * Tab "Errores de auth" — intentos de autenticación RADIUS (Access-Reject /
 * Access-Accept). El filtro Resultado arranca en Access-Reject por defecto porque
 * el feature ES "errores"; el usuario puede elegir "Todos" o Access-Accept.
 *
 * El scheduler `radius-auth-ingest` está dark por default, así que la tabla puede
 * venir vacía hasta que se prenda: el empty state es informativo, NO un error.
 */
export default function RadiusAuthErrorsPage() {
  const { filter, setFilter, clearFilter } = useAuthFailuresFilterUrl();
  const page = filter.page ?? 1;

  // '' (no seteado en URL) → default Access-Reject. 'all' → sin filtro (Todos).
  const effectiveReply = filter.reply === '' || filter.reply == null ? 'Access-Reject' : filter.reply;
  const replyParam: RadiusAuthReply | undefined =
    effectiveReply === 'all' ? undefined : effectiveReply;

  const queryParams = {
    username: filter.username || undefined,
    reply:    replyParam,
    from:     filter.from || undefined,
    to:       filter.to || undefined,
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isError } = useRadiusAuthFailures(queryParams);

  // usar el limit que devuelve el BE (lo capa a MAX_LIMIT) en vez del LIMIT local
  const totalPages = data ? Math.ceil(data.total / (data.limit || LIMIT)) : 1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Errores de auth</h1>
        {data && <span className={styles.badge}>{data.total}</span>}
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
          value={effectiveReply}
          onChange={(e) =>
            setFilter({ reply: e.target.value as typeof filter.reply, page: 1 })
          }
          aria-label="Filtrar por resultado"
        >
          <option value="Access-Reject">Access-Reject</option>
          <option value="Access-Accept">Access-Accept</option>
          <option value="all">Todos</option>
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
        <button type="button" className={styles.btnClear} onClick={clearFilter}>
          Limpiar
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Resultado</th>
              <th>Fecha</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className={styles.stateCell}>
                  <span className={styles.spinner} aria-label="Cargando" />
                  Cargando...
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td colSpan={4} className={styles.stateCell}>
                  Error al cargar los intentos de auth
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.stateCell}>
                  No hay intentos de auth
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.map((evt) => (
              <tr key={evt.id}>
                <td className={styles.mono}>{evt.username}</td>
                <td>
                  {evt.reply === 'Access-Reject' ? (
                    <span className={styles.badgeReject}>Access-Reject</span>
                  ) : (
                    <span className={styles.badgeAccept}>Access-Accept</span>
                  )}
                </td>
                <td>{formatDateTimeShort(evt.authdate)}</td>
                <td className={styles.mono}>{evt.class ?? '—'}</td>
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
