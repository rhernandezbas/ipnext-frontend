import { usePppoeNasMoveEvents } from '@/hooks/usePppoeNasMoveEvents';
import { useNasMovesFilterUrl } from './hooks/useNasMovesFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import {
  PPPOE_NAS_MOVE_OUTCOMES,
  type PppoeNasMoveOutcome,
  type PppoeNasMoveTrigger,
} from '@/types/pppoeNasMove';
import styles from './PppoeNasMovesPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

/**
 * Etiqueta humana + familia de badge por outcome. Familias del design system
 * (contraste WCAG AA verificado en el CSS module):
 *   moved     → éxito (verde)
 *   failed_*  → error (rojo, familia "late")
 *   skipped_* → warning (naranja, familia "blocked")
 */
const OUTCOME_META: Record<PppoeNasMoveOutcome, { label: string; className: string }> = {
  moved:              { label: 'Movido',                   className: styles.badgeMoved },
  failed_no_free_ip:  { label: 'Fallo: pool sin IPs',      className: styles.badgeFailed },
  failed_orchestrator:{ label: 'Fallo: RADIUS',            className: styles.badgeFailed },
  failed_db:          { label: 'Fallo: DB',                className: styles.badgeFailed },
  failed_router:      { label: 'Fallo: router',            className: styles.badgeFailed },
  skipped_public:     { label: 'Salteado: IP pública',     className: styles.badgeSkipped },
  skipped_unknown_nas:{ label: 'Salteado: NAS desconocido', className: styles.badgeSkipped },
};

const TRIGGER_LABELS: Record<PppoeNasMoveTrigger, string> = {
  manual: 'Manual',
  auto: 'Auto',
};

function OutcomeBadge({ outcome }: { outcome: PppoeNasMoveOutcome }) {
  const meta = OUTCOME_META[outcome];
  if (!meta) {
    // Outcome nuevo del BE que el FE aún no conoce: texto plano, sin romper.
    return <span className={styles.mono}>{outcome}</span>;
  }
  return <span className={`${styles.badge} ${meta.className}`}>{meta.label}</span>;
}

/**
 * Tab "Movimientos NAS" — registro VISIBLE de los movimientos de NAS PPPoE
 * (pppoe-move-nas W1, REQ-LOG-1). Cada intento de move (manual o auto) que
 * llegó a la fase de asignación persiste una fila con su outcome; acá se ven
 * también los FALLOS del auto-move (pool lleno) y los skips (IP pública), que
 * antes solo vivían en el stdout del container.
 *
 * Filtros con round-trip en la URL (namespace mv_*, patrón de los tabs
 * vecinos) + paginado server-side. Permiso: la page /admin/networking/audit ya
 * está gateada por `network.read` a nivel ruta (RequirePermission) — mismo
 * patrón que Logs RADIUS / NE8000 / Errores de auth (sin gate interno); el BE
 * gatea el endpoint con `network.read` (defensa en profundidad, mismo permiso
 * que los 3 tabs vecinos).
 */
export default function PppoeNasMovesPage() {
  const { filter, setFilter, clearFilter } = useNasMovesFilterUrl();
  const page = filter.page ?? 1;

  const { data, isLoading, isError } = usePppoeNasMoveEvents({
    outcome: filter.outcome,
    trigger: filter.trigger,
    username: filter.username || undefined,
    page,
    limit: LIMIT,
  });

  // usar el limit que devuelve el BE (lo capa a MAX_LIMIT) en vez del LIMIT local
  const totalPages = data ? Math.ceil(data.total / (data.limit || LIMIT)) : 1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Movimientos NAS</h1>
        {data && <span className={styles.countBadge}>{data.total}</span>}
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.select}
          value={filter.outcome ?? ''}
          onChange={(e) =>
            setFilter({
              outcome: (e.target.value || undefined) as PppoeNasMoveOutcome | undefined,
              page: 1,
            })
          }
          aria-label="Filtrar por resultado"
        >
          <option value="">Todos</option>
          {PPPOE_NAS_MOVE_OUTCOMES.map((o) => (
            <option key={o} value={o}>{OUTCOME_META[o].label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filter.trigger ?? ''}
          onChange={(e) =>
            setFilter({
              trigger: (e.target.value || undefined) as PppoeNasMoveTrigger | undefined,
              page: 1,
            })
          }
          aria-label="Filtrar por trigger"
        >
          <option value="">Todos</option>
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
        </select>
        <input
          type="text"
          className={styles.input}
          placeholder="Username"
          value={filter.username ?? ''}
          onChange={(e) => setFilter({ username: e.target.value || undefined, page: 1 })}
          aria-label="Filtrar por username"
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
              <th>Fecha</th>
              <th>Usuario</th>
              <th>De</th>
              <th>A</th>
              <th>IP</th>
              <th>Trigger</th>
              <th>Resultado</th>
              <th>Motivo</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className={styles.stateCell}>
                  <span className={styles.spinner} aria-label="Cargando" />
                  Cargando...
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td colSpan={9} className={styles.stateCell}>
                  Error al cargar los movimientos de NAS
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.items.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.stateCell}>
                  Sin movimientos registrados
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.items.map((evt) => (
              <tr key={evt.id}>
                <td>{formatDateTimeShort(evt.createdAt)}</td>
                <td className={styles.mono}>{evt.username}</td>
                <td>{evt.fromNas?.name ?? '—'}</td>
                <td>{evt.toNas?.name ?? '—'}</td>
                <td className={styles.mono}>{evt.fromIp ?? '—'} → {evt.toIp ?? '—'}</td>
                <td>{TRIGGER_LABELS[evt.trigger] ?? evt.trigger}</td>
                <td><OutcomeBadge outcome={evt.outcome} /></td>
                <td className={styles.reasonCell}>{evt.reason ?? '—'}</td>
                <td>{evt.actorName ?? '—'}</td>
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
