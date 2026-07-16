import { useRadiusSessionCures } from '@/hooks/useRadiusSessionCures';
import { useSessionCuresFilterUrl } from './hooks/useSessionCuresFilterUrl';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort, formatRelative } from '@/utils/formatDate';
import {
  RADIUS_SESSION_CURE_OUTCOMES,
  type RadiusSessionCureOutcome,
  type RadiusSessionCureTrigger,
  type RadiusSessionCureEvent,
} from '@/types/radiusSessionCure';
import styles from './RadiusSessionCuresPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 50;

/**
 * Etiqueta humana + familia de badge por outcome (molde OutcomeBadge de
 * PppoeNasMovesPage — D-W2.5.5: outcomes desconocidos degradan a texto plano).
 * `flagged_flapping` lleva su PROPIA clase (`badgeFlapping`, ver .module.css):
 * ≥3 curas/24h del mismo username delata credencial compartida/clon — es un
 * caso de SOPORTE, no un simple "fallo", por eso el tratamiento visual
 * destacado (rojo más fuerte, distinto del family de `failed`).
 */
const OUTCOME_META: Record<RadiusSessionCureOutcome, { label: string; className: string; title?: string }> = {
  cured:              { label: 'Curada',      className: styles.badgeCured },
  already_cured:      { label: 'Ya curada',   className: styles.badgeAlreadyCured },
  skipped_alive:      { label: 'Sesión viva', className: styles.badgeSkippedAlive },
  skipped_ambiguous:  { label: 'Ambigua',     className: styles.badgeSkippedAlive },
  skipped_no_session: { label: 'Sin sesión',  className: styles.badgeNeutral },
  skipped_no_signal:  { label: 'Sin señal',   className: styles.badgeNeutral },
  flagged_flapping:   {
    label: 'Flapping',
    className: styles.badgeFlapping,
    title: '≥3 curas en 24h del mismo usuario — posible credencial compartida o sesión clonada. Caso de soporte.',
  },
  failed:              { label: 'Fallo',      className: styles.badgeFailed },
};

const TRIGGER_LABELS: Record<RadiusSessionCureTrigger, string> = {
  manual: 'Manual',
  auto: 'Auto',
};

/** Humaniza `signalUsed` para la columna "Evidencia" (D6/D8). */
const SIGNAL_LABELS: Record<'persistent_rejects' | 'stale_interim', string> = {
  persistent_rejects: 'Rejects sostenidos',
  stale_interim: 'Interim viejo',
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const meta = (RADIUS_SESSION_CURE_OUTCOMES as readonly string[]).includes(outcome)
    ? OUTCOME_META[outcome as RadiusSessionCureOutcome]
    : undefined;
  if (!meta) {
    // Outcome nuevo del BE (String libre, D8) sin release FE todavía → texto
    // plano, NUNCA crashea la tabla (lección OutcomeBadge / D-W2.5.5).
    return <span className={styles.mono}>{outcome}</span>;
  }
  return (
    <span className={`${styles.badge} ${meta.className}`} title={meta.title}>
      {meta.label}
    </span>
  );
}

/** Columna "Evidencia": signalUsed humanizado + recencia de sessionLastUpdate. */
function EvidenceCell({ evt }: { evt: RadiusSessionCureEvent }) {
  if (!evt.signalUsed) {
    return <span className={styles.motivoEmpty}>—</span>;
  }
  return (
    <span>
      {SIGNAL_LABELS[evt.signalUsed]}
      {evt.sessionLastUpdate && (
        <span className={styles.evidenceRecency}> · {formatRelative(evt.sessionLastUpdate)}</span>
      )}
    </span>
  );
}

/** Formatea un número con el separador de miles argentino (punto). */
function formatCount(n: number): string {
  return n.toLocaleString('es-AR');
}

const CHIP_ORDER: RadiusSessionCureOutcome[] = [
  'cured', 'already_cured', 'skipped_alive', 'skipped_ambiguous',
  'skipped_no_session', 'skipped_no_signal', 'flagged_flapping', 'failed',
];

/**
 * Tab "Sesiones curadas" — auditoría del watcher `AutoCureStuckSessions` + la cura
 * manual (radius-session-autocure FE-1, REQ-FE-CURE-1). Chips de countsByOutcome
 * (patrón de los chips de reason de "Errores de auth" — S1.2: filtrar NO cambia el
 * desglose de los chips, siempre es el total). Permiso: el tab vive dentro de
 * NetworkAuditPage, ya gateado `network.read` a nivel ruta (RequirePermission) —
 * mismo patrón que sus 4 tabs vecinos, sin gate interno (S1.4: nunca "visible pero
 * muerto" en 403 — el guard es de ruta, no se monta sin el permiso).
 */
export default function RadiusSessionCuresPage() {
  const { filter, setFilter, clearFilter } = useSessionCuresFilterUrl();
  const page = filter.page ?? 1;

  const { data, isLoading, isError } = useRadiusSessionCures({
    username: filter.username || undefined,
    outcome: filter.outcome,
    trigger: filter.trigger,
    from: filter.from || undefined,
    to: filter.to || undefined,
    page,
    limit: LIMIT,
  });

  const totalPages = data ? Math.ceil(data.total / (data.limit || LIMIT)) : 1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Sesiones curadas</h1>
        {data && <span className={styles.badgeTotal}>{data.total}</span>}
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.select}
          value={filter.outcome ?? ''}
          onChange={(e) =>
            setFilter({
              outcome: (e.target.value || undefined) as RadiusSessionCureOutcome | undefined,
              page: 1,
            })
          }
          aria-label="Filtrar por resultado"
        >
          <option value="">Todos</option>
          {RADIUS_SESSION_CURE_OUTCOMES.map((o) => (
            <option key={o} value={o}>{OUTCOME_META[o].label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filter.trigger ?? ''}
          onChange={(e) =>
            setFilter({
              trigger: (e.target.value || undefined) as RadiusSessionCureTrigger | undefined,
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

      {/* Outcome chips — SIEMPRE el desglose completo (S1.2: filtrar no los cambia).
          Label DISTINTO del <select> de arriba ("Resultado — chips" vs "Filtrar
          por resultado") para que getByLabelText no ambigüe entre ambos. */}
      <div className={styles.chipBar} role="group" aria-label="Resultado — chips">
        {CHIP_ORDER.map((outcome) => {
          const isActive = filter.outcome === outcome;
          const count = data?.countsByOutcome?.[outcome];
          const meta = OUTCOME_META[outcome];
          return (
            <button
              key={outcome}
              type="button"
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
              aria-pressed={isActive}
              onClick={() =>
                isActive
                  ? setFilter({ outcome: undefined, page: 1 })
                  : setFilter({ outcome, page: 1 })
              }
            >
              {meta.label}
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
              <th>NAS</th>
              <th>Sesión</th>
              <th>Evidencia</th>
              <th>Trigger</th>
              <th>Actor</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className={styles.stateCell}>
                  <span className={styles.spinner} aria-label="Cargando" />
                  Cargando...
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td colSpan={8} className={styles.stateCell}>
                  Error al cargar las sesiones curadas
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.stateCell}>
                  No hay curas registradas
                </td>
              </tr>
            )}
            {!isLoading && !isError && data && data.data.map((evt) => (
              <tr key={evt.id}>
                <td className={styles.mono}>{evt.username}</td>
                <td><OutcomeBadge outcome={evt.outcome} /></td>
                <td className={styles.mono}>{evt.nasIp ?? '—'}</td>
                <td className={styles.mono}>{evt.sessionId ?? '—'}</td>
                <td><EvidenceCell evt={evt} /></td>
                <td>{TRIGGER_LABELS[evt.trigger] ?? evt.trigger}</td>
                <td>{evt.actorName ?? '—'}</td>
                <td>{formatDateTimeShort(evt.createdAt)}</td>
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
