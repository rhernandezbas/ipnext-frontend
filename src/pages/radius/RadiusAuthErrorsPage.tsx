import { useRadiusAuthFailures } from '@/hooks/useRadiusAuthFailures';
import { useAuthFailuresFilterUrl } from './hooks/useAuthFailuresFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { RadiusAuthReply } from '@/types/networkAudit';
import styles from './RadiusAuthErrorsPage.module.css';

// ── Component ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

/**
 * Mapeo del `reason` del BE (inglés) → etiqueta en español + clase de badge.
 * Los valores son los que el orchestrator persiste; NO inventar valores en español.
 *   session_stuck  → naranja (el más importante: cliente bloqueado por sesión anterior)
 *   user_not_found → rojo
 *   other          → gris
 *   null / desconocido → "—" sin badge (gris tenue)
 */
const MOTIVO_MAP: Record<string, { label: string; className: string }> = {
  session_stuck:  { label: 'Sesión colgada',  className: styles.badgeStuck },
  user_not_found: { label: 'Usuario no existe', className: styles.badgeNotFound },
  other:          { label: 'Otro / revisar',   className: styles.badgeOther },
};

type ReasonKey = 'session_stuck' | 'user_not_found' | 'other';

/**
 * Configuración de los chips de filtro por motivo.
 * Cada chip tiene clases CSS distintas para su estado inactivo y activo.
 * El estado activo invierte los colores: badge-fg pasa a ser el fondo,
 * texto blanco. Contrastes verificados WCAG AA (≥4.5:1) para todos los activos:
 *   stuck    #fff/#9a3412  ≈ 6.38:1
 *   notFound #fff/#991b1b  ≈ 6.80:1
 *   other    #fff/#495057  ≈ 7.43:1
 *   todos    #fff/#343a40  > 11:1
 */
const CHIP_CONFIG = [
  {
    key: 'all' as const,
    label: 'Todos',
    inactiveClass: styles.chipTodos,
    activeClass:   styles.chipTodosActive,
  },
  {
    key: 'session_stuck' as ReasonKey,
    label: MOTIVO_MAP.session_stuck.label,
    inactiveClass: styles.chipStuck,
    activeClass:   styles.chipStuckActive,
  },
  {
    key: 'user_not_found' as ReasonKey,
    label: MOTIVO_MAP.user_not_found.label,
    inactiveClass: styles.chipNotFound,
    activeClass:   styles.chipNotFoundActive,
  },
  {
    key: 'other' as ReasonKey,
    label: MOTIVO_MAP.other.label,
    inactiveClass: styles.chipOther,
    activeClass:   styles.chipOtherActive,
  },
] as const;

/** Formatea un número con el separador de miles argentino (punto). */
function formatCount(n: number): string {
  return n.toLocaleString('es-AR');
}

function MotivoBadge({ reason }: { reason: string | null }) {
  const entry = reason ? MOTIVO_MAP[reason] : undefined;
  if (!entry) {
    return <span className={styles.motivoEmpty}>—</span>;
  }
  return <span className={entry.className}>{entry.label}</span>;
}

/**
 * Tab "Errores de auth" — intentos de autenticación RADIUS (Access-Reject /
 * Access-Accept). El filtro Resultado arranca en Access-Reject por defecto porque
 * el feature ES "errores"; el usuario puede elegir "Todos" o Access-Accept.
 *
 * El scheduler `radius-auth-ingest` está dark por default, así que la tabla puede
 * venir vacía hasta que se prenda: el empty state es informativo, NO un error.
 *
 * Ola 2: chips de conteo por motivo arriba de la tabla. Clic en chip → filtra la
 * lista por reason. Clic en chip activo → limpia el filtro.
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
    reason: filter.reason,
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

      {/* Reason chips — siempre visibles; conteos solo cuando data disponible.
          Clic en chip activo → limpia filtro (toggle). Clic en chip diferente → setea.
          aria-pressed = estado de toggle (WCAG 1.3.3). */}
      <div className={styles.chipBar} role="group" aria-label="Filtrar por motivo">
        {CHIP_CONFIG.map((chip) => {
          const isActive = chip.key === 'all'
            ? !filter.reason
            : filter.reason === chip.key;
          const count = chip.key !== 'all' && data?.countsByReason
            ? data.countsByReason[chip.key as ReasonKey]
            : undefined;
          return (
            <button
              key={chip.key}
              type="button"
              className={`${styles.chip} ${isActive ? chip.activeClass : chip.inactiveClass}`}
              aria-pressed={isActive}
              onClick={() => {
                if (chip.key === 'all' || isActive) {
                  setFilter({ reason: undefined, page: 1 });
                } else {
                  setFilter({ reason: chip.key as ReasonKey, page: 1 });
                }
              }}
            >
              {chip.label}
              {count !== undefined && (
                <span className={styles.chipCount}>{` · ${formatCount(count)}`}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Resultado</th>
              <th>Fecha</th>
              <th>Motivo</th>
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
                <td><MotivoBadge reason={evt.reason} /></td>
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
