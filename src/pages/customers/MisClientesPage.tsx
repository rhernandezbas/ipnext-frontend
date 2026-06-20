import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import {
  useMyPortfolio,
  usePortfolioByVendedor,
  useAllPortfolios,
} from '@/hooks/usePortfolio';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useGrVendedores } from '@/hooks/useGrVendedorMappings';
import { AGE_BUCKETS, AGE_BUCKET_LABELS } from '@/types/portfolio';
import type { AgeBucket, PortfolioItem, PortfolioSummary } from '@/types/portfolio';
import { CLIENT_STATUS_LABELS } from './clientStatusLabels';
import styles from './MisClientesPage.module.css';

/**
 * Maps the GR client status string to a StatusBadge PRESENTATION variant
 * (color). The badge atom only accepts a fixed variant union; the readable copy
 * is supplied via the `label` prop using CLIENT_STATUS_LABELS (GR vocabulary).
 * Unknown statuses fall back to the neutral `inactive` variant.
 */
type BadgeVariant = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

function badgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
    case 'late':
    case 'blocked':
    case 'inactive':
    case 'baja':
      return status;
    default:
      return 'inactive';
  }
}

/** Format a debt amount + currency. Falls back gracefully when currency is null. */
function formatDebt(amount: number | null, currency: string | null): string {
  const value = (amount ?? 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${value}` : `$ ${value}`;
}

// ── View mode ───────────────────────────────────────────────────────────────

/** Sentinel selector values that are NOT a vendedor name. */
const MODE_MINE = '__mine__';
const MODE_ALL = '__all__';

/**
 * The cartera the page is showing. `__mine__` is the agent's own (always
 * available); `__all__` and any vendedor name are super-admin only.
 */
type ViewMode = typeof MODE_MINE | typeof MODE_ALL | string;

/** Rows per page in the paginated table — kills the 1000-row wall. */
const PAGE_SIZE = 25;

// ── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  total: number;
  active: number;
  withDebt: number;
  withClaims: number;
}

function SummaryCards({ total, active, withDebt, withClaims }: SummaryCardsProps) {
  const cards = [
    { label: 'Total', value: total, tone: 'total' as const },
    { label: 'Activos', value: active, tone: 'active' as const },
    { label: 'Con deuda', value: withDebt, tone: 'debt' as const },
    { label: 'Con reclamos', value: withClaims, tone: 'claims' as const },
  ];
  return (
    <div className={styles.summaryRow} aria-label="Resumen de la cartera">
      {cards.map((card) => (
        <div key={card.label} className={`${styles.summaryCard} ${styles[card.tone]}`}>
          <span className={styles.summaryValue}>{card.value.toLocaleString('es-AR')}</span>
          <span className={styles.summaryLabel}>{card.label}</span>
        </div>
      ))}
    </div>
  );
}

interface AgeBreakdownProps {
  byBucket: Record<AgeBucket, number>;
  /** Currently active bucket filter, or null when none. */
  activeBucket: AgeBucket | null;
  /** Toggle the filter for a bucket (click an active one again to clear). */
  onToggle: (bucket: AgeBucket) => void;
}

/**
 * Four clickable mini-cards (one per age bucket). Clicking toggles the
 * client-side filter for that bucket; the active card is highlighted and
 * exposes `aria-pressed` so it reads as a toggle, not a static stat.
 */
function AgeBreakdown({ byBucket, activeBucket, onToggle }: AgeBreakdownProps) {
  return (
    <div className={styles.breakdownRow} aria-label="Antigüedad de la cartera">
      {AGE_BUCKETS.map((bucket) => {
        const isActive = activeBucket === bucket;
        return (
          <button
            key={bucket}
            type="button"
            aria-pressed={isActive}
            className={`${styles.breakdownCard} ${isActive ? styles.breakdownCardActive : ''}`}
            onClick={() => onToggle(bucket)}
          >
            <span className={styles.breakdownValue}>{byBucket[bucket].toLocaleString('es-AR')}</span>
            <span className={styles.breakdownLabel}>{AGE_BUCKET_LABELS[bucket]}</span>
          </button>
        );
      })}
    </div>
  );
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Status values present in the (unfiltered) dataset, in display order. */
  statusOptions: string[];
  status: string;
  onStatusChange: (value: string) => void;
  onlyDebt: boolean;
  onToggleDebt: () => void;
  onlyClaims: boolean;
  onToggleClaims: () => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

/**
 * Client-side filter controls. All combinable: search by name, single-select
 * status, plus two boolean toggles. "Limpiar filtros" only appears when at
 * least one filter (incl. the age bucket, handled by the parent) is active.
 */
function FilterBar({
  search,
  onSearchChange,
  statusOptions,
  status,
  onStatusChange,
  onlyDebt,
  onToggleDebt,
  onlyClaims,
  onToggleClaims,
  hasActiveFilters,
  onClear,
}: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrap}>
        <svg
          className={styles.searchIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar cliente por nombre…"
          aria-label="Buscar cliente por nombre"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <label className={styles.statusFilter}>
        <span className={styles.srOnly}>Filtrar por estado</span>
        <select
          className={styles.statusSelect}
          aria-label="Filtrar por estado"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        aria-pressed={onlyDebt}
        className={`${styles.toggle} ${onlyDebt ? styles.toggleActive : ''}`}
        onClick={onToggleDebt}
      >
        Con deuda
      </button>
      <button
        type="button"
        aria-pressed={onlyClaims}
        className={`${styles.toggle} ${onlyClaims ? styles.toggleActive : ''}`}
        onClick={onToggleClaims}
      >
        Con reclamos
      </button>

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}

/** A portfolio item that may carry its owning vendedor (admin "all" view). */
type PortfolioRow = PortfolioItem & { vendedor?: string };

interface ClientsTableProps {
  rows: PortfolioRow[];
  /** When true, render the Agente column (admin "all" view). */
  showAgente: boolean;
}

/**
 * Paginated client table. Renders ONLY the current page of rows (passed in
 * pre-sliced by the parent). Horizontal scroll wrapper keeps wide tables from
 * breaking the layout on mobile.
 */
function ClientsTable({ rows, showAgente }: ClientsTableProps) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Estado</th>
            <th scope="col">Antigüedad</th>
            <th scope="col" className={styles.numCol}>Contratos</th>
            <th scope="col">Deuda</th>
            <th scope="col">Reclamos</th>
            {showAgente ? <th scope="col">Agente</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={showAgente ? `${row.clientId}::${row.vendedor ?? idx}` : row.clientId}>
              <td>
                <Link to={`/admin/customers/view/${row.clientId}`} className={styles.clientLink}>
                  {row.clientName}
                </Link>
              </td>
              <td>
                <StatusBadge
                  status={badgeVariant(row.status)}
                  label={CLIENT_STATUS_LABELS[row.status] ?? row.status}
                />
              </td>
              <td className={styles.ageCell}>{AGE_BUCKET_LABELS[row.ageBucket]}</td>
              <td className={styles.numCol}>{row.contractsCount}</td>
              <td>
                {row.hasDebt ? (
                  <span className={`${styles.chip} ${styles.chipDebt}`}>
                    {formatDebt(row.debtAmount, row.debtCurrency)}
                  </span>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
              </td>
              <td>
                {row.openClaims > 0 ? (
                  <span
                    className={`${styles.chip} ${styles.chipClaims}`}
                    aria-label={`${row.openClaims} reclamos abiertos`}
                  >
                    {row.openClaims} {row.openClaims === 1 ? 'reclamo' : 'reclamos'}
                  </span>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
              </td>
              {showAgente ? (
                <td>
                  <span
                    className={`${styles.chip} ${styles.chipAgente}`}
                    aria-label={`Agente: ${row.vendedor ?? '—'}`}
                  >
                    {row.vendedor ?? '—'}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PortfolioExplorerProps {
  items: PortfolioRow[];
  summary: PortfolioSummary;
  /** When true, each row shows its owning agente/vendedor (admin "all" view). */
  showAgente: boolean;
  /** Copy for the (no-data) empty state — varies per mode. */
  emptyTitle: string;
  emptyText: string;
}

/**
 * The new data-dense view: summary KPIs + clickable age breakdown + a filter
 * bar driving a paginated table. Filters and search are derived during render
 * (no effects); the current page is clamped so changing filters never strands
 * the user on an out-of-range page.
 */
function PortfolioExplorer({ items, summary, showAgente, emptyTitle, emptyText }: PortfolioExplorerProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [bucket, setBucket] = useState<AgeBucket | null>(null);
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [onlyClaims, setOnlyClaims] = useState(false);
  const [page, setPage] = useState(1);

  // Defer the search term so typing stays responsive on huge lists (the heavy
  // filter recompute runs against the deferred value, not every keystroke).
  const deferredSearch = useDeferredValue(search);

  const hasActiveFilters =
    deferredSearch.trim() !== '' || status !== '' || bucket !== null || onlyDebt || onlyClaims;

  // Status values actually present, in canonical display order.
  const statusOptions = useMemo(() => {
    const present = new Set(items.map((it) => it.status));
    const ordered = Object.keys(CLIENT_STATUS_LABELS).filter((s) => present.has(s));
    // Include any unknown statuses that aren't in the label map, just in case.
    const extras = [...present].filter((s) => !(s in CLIENT_STATUS_LABELS));
    return [...ordered, ...extras];
  }, [items]);

  // Derived filtered list — recomputed during render, never via useEffect.
  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return items.filter((it) => {
      if (needle && !it.clientName.toLowerCase().includes(needle)) return false;
      if (status && it.status !== status) return false;
      if (bucket && it.ageBucket !== bucket) return false;
      if (onlyDebt && !it.hasDebt) return false;
      if (onlyClaims && it.openClaims <= 0) return false;
      return true;
    });
  }, [items, deferredSearch, status, bucket, onlyDebt, onlyClaims]);

  // No-data: the dataset itself is empty (not a filter miss).
  if (items.length === 0) {
    return (
      <div className={styles.stateBox}>
        <p className={styles.stateTitle}>{emptyTitle}</p>
        <p className={styles.stateText}>{emptyText}</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp the page in case filters shrank the result set below the current page.
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // Reset to page 1 whenever a filter changes (the setter wrappers below).
  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setStatus('');
    setBucket(null);
    setOnlyDebt(false);
    setOnlyClaims(false);
    resetPage();
  }

  return (
    <>
      <SummaryCards
        total={summary.total}
        active={summary.active}
        withDebt={summary.withDebt}
        withClaims={summary.withClaims}
      />

      <AgeBreakdown
        byBucket={summary.byBucket}
        activeBucket={bucket}
        onToggle={(b) => {
          setBucket((prev) => (prev === b ? null : b));
          resetPage();
        }}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          resetPage();
        }}
        statusOptions={statusOptions}
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          resetPage();
        }}
        onlyDebt={onlyDebt}
        onToggleDebt={() => {
          setOnlyDebt((v) => !v);
          resetPage();
        }}
        onlyClaims={onlyClaims}
        onToggleClaims={() => {
          setOnlyClaims((v) => !v);
          resetPage();
        }}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      {filtered.length === 0 ? (
        <div className={styles.stateBox} data-testid="no-results">
          <p className={styles.stateTitle}>Sin resultados</p>
          <p className={styles.stateText}>
            Ningún cliente coincide con los filtros actuales. Probá con otro nombre o quitá algún filtro.
          </p>
          <Button variant="primary" size="md" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.resultMeta} role="status" aria-live="polite">
            Mostrando {startIdx + 1}–{startIdx + pageRows.length} de {filtered.length.toLocaleString('es-AR')}
          </div>

          <ClientsTable rows={pageRows} showAgente={showAgente} />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

interface CarteraSelectorProps {
  mode: ViewMode;
  vendedores: string[];
  onChange: (mode: ViewMode) => void;
}

/**
 * Super-admin-only picker (gated by recapture.manage at the call site).
 * Native <select>: vendedores can be many, so a dropdown scales past the
 * 2–5 sweet spot of a segmented control. Options: Mi cartera (default),
 * Todos los agentes, then each vendedor.
 */
function CarteraSelector({ mode, vendedores, onChange }: CarteraSelectorProps) {
  return (
    <label className={styles.selectorLabel}>
      <span className={styles.selectorCaption}>Ver cartera</span>
      <select
        className={styles.selector}
        aria-label="Ver cartera de"
        value={mode}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={MODE_MINE}>Mi cartera</option>
        <option value={MODE_ALL}>Todos los agentes</option>
        {vendedores.length > 0 ? (
          <optgroup label="Agentes">
            {vendedores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MisClientesPage() {
  const { can } = useMyPermissions();
  const canManage = can('recapture.manage');

  const [mode, setMode] = useState<ViewMode>(MODE_MINE);
  // A non-admin can never be in an admin mode; coerce defensively.
  const effectiveMode: ViewMode = canManage ? mode : MODE_MINE;

  const isMine = effectiveMode === MODE_MINE;
  const isAll = effectiveMode === MODE_ALL;
  const isVendedor = !isMine && !isAll;
  const selectedVendedor = isVendedor ? effectiveMode : '';

  // All three queries are declared unconditionally (Rules of Hooks); the admin
  // ones stay disabled unless their mode is active under a manage gate.
  const mineQuery = useMyPortfolio();
  const vendedorQuery = usePortfolioByVendedor(selectedVendedor, canManage && isVendedor);
  const allQuery = useAllPortfolios(canManage && isAll);
  const { data: vendedores = [] } = useGrVendedores();

  // Pick the active query for the current mode.
  const active = isAll ? allQuery : isVendedor ? vendedorQuery : mineQuery;
  const { isLoading, isError, refetch, isFetching } = active;

  // `unmapped` only exists on the /mine payload.
  const mineData = isMine ? mineQuery.data : undefined;
  const isUnmapped = Boolean(mineData?.unmapped);

  const title = isAll
    ? 'Todas las carteras'
    : isVendedor
      ? `Cartera de ${selectedVendedor}`
      : 'Mis clientes';

  const items: PortfolioRow[] = active.data?.items ?? [];
  const summary = active.data?.summary;

  // Remount the explorer when the mode changes so its internal filter/page
  // state resets cleanly between carteras.
  const explorerKey = effectiveMode;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Clientes /</span>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.headerRight}>
          {canManage ? (
            <CarteraSelector mode={mode} vendedores={vendedores} onChange={setMode} />
          ) : null}
          {!isUnmapped ? (
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
              Actualizar
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.centered} aria-label="Cargando cartera">
          <Spinner />
        </div>
      ) : isError ? (
        <div className={styles.stateBox} role="alert">
          <p className={styles.stateTitle}>No se pudo cargar la cartera</p>
          <p className={styles.stateText}>Revisá tu conexión e intentá de nuevo.</p>
          <Button variant="primary" size="md" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isUnmapped ? (
        <div className={styles.stateBox}>
          <p className={styles.stateTitle}>No estás mapeado a un vendedor</p>
          <p className={styles.stateText}>
            Pedile a un admin que te asigne en{' '}
            <Link to="/admin/customers/settings" className={styles.inlineLink}>
              Clientes → Configuración → Vendedores GR
            </Link>
            .
          </p>
        </div>
      ) : summary ? (
        <PortfolioExplorer
          key={explorerKey}
          items={items}
          summary={summary}
          showAgente={isAll}
          emptyTitle={
            isAll
              ? 'No hay carteras para mostrar'
              : isVendedor
                ? 'Este vendedor no tiene clientes en su cartera'
                : 'Todavía no tenés clientes en tu cartera'
          }
          emptyText={
            isAll
              ? 'Cuando los agentes den de alta clientes a través de sus vendedores, van a aparecer acá.'
              : isVendedor
                ? 'Los clientes que este vendedor dé de alta van a aparecer acá.'
                : 'Los clientes que des de alta a través de tu vendedor van a aparecer acá.'
          }
        />
      ) : null}
    </div>
  );
}
