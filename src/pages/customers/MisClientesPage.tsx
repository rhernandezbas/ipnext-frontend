import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import {
  useMyPortfolio,
  usePortfolioByVendedor,
  useAllPortfolios,
} from '@/hooks/usePortfolio';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useGrVendedores } from '@/hooks/useGrVendedorMappings';
import { AGE_BUCKETS, AGE_BUCKET_LABELS } from '@/types/portfolio';
import type { PortfolioItem, PortfolioSummary } from '@/types/portfolio';
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

interface ClientRowProps {
  item: PortfolioItem;
  /** Owning vendedor — only shown in the "Todos los agentes" view. */
  vendedor?: string;
}

function ClientRow({ item, vendedor }: ClientRowProps) {
  return (
    <Link to={`/admin/customers/view/${item.clientId}`} className={styles.clientRow}>
      <span className={styles.clientName}>{item.clientName}</span>
      <span className={styles.clientMeta}>
        {vendedor ? (
          <span className={`${styles.chip} ${styles.chipAgente}`} aria-label={`Agente: ${vendedor}`}>
            {vendedor}
          </span>
        ) : null}
        <StatusBadge
          status={badgeVariant(item.status)}
          label={CLIENT_STATUS_LABELS[item.status] ?? item.status}
        />
        <span className={styles.contracts}>
          {item.contractsCount} {item.contractsCount === 1 ? 'contrato' : 'contratos'}
        </span>
        {item.hasDebt ? (
          <span className={`${styles.chip} ${styles.chipDebt}`}>
            {formatDebt(item.debtAmount, item.debtCurrency)}
          </span>
        ) : null}
        {item.openClaims > 0 ? (
          <span
            className={`${styles.chip} ${styles.chipClaims}`}
            aria-label={`${item.openClaims} reclamos abiertos`}
          >
            {item.openClaims} {item.openClaims === 1 ? 'reclamo' : 'reclamos'}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** A portfolio item that may carry its owning vendedor (admin "all" view). */
type PortfolioRow = PortfolioItem & { vendedor?: string };

interface PortfolioBodyProps {
  items: PortfolioRow[];
  summary: PortfolioSummary;
  /** When true, each row shows its owning agente/vendedor (admin "all" view). */
  showAgente: boolean;
  /** Copy for the empty state — varies per mode. */
  emptyTitle: string;
  emptyText: string;
}

/**
 * The reusable portfolio render: summary cards + age-bucket sections + rows.
 * Shared by all three modes (mine / by-vendedor / all). The only per-mode
 * difference is the optional Agente badge and the empty-state copy.
 */
function PortfolioBody({ items, summary, showAgente, emptyTitle, emptyText }: PortfolioBodyProps) {
  if (items.length === 0) {
    return (
      <div className={styles.stateBox}>
        <p className={styles.stateTitle}>{emptyTitle}</p>
        <p className={styles.stateText}>{emptyText}</p>
      </div>
    );
  }

  return (
    <>
      <SummaryCards
        total={summary.total}
        active={summary.active}
        withDebt={summary.withDebt}
        withClaims={summary.withClaims}
      />

      {AGE_BUCKETS.map((bucket) => {
        const clients = items.filter((it) => it.ageBucket === bucket);
        if (clients.length === 0) return null;
        return (
          <section key={bucket} className={styles.bucketSection} aria-label={AGE_BUCKET_LABELS[bucket]}>
            <header className={styles.bucketHeader}>
              <h2 className={styles.bucketTitle}>{AGE_BUCKET_LABELS[bucket]}</h2>
              <span className={styles.bucketCount}>{summary.byBucket[bucket]}</span>
            </header>
            <div className={styles.clientList}>
              {clients.map((row, idx) => (
                <ClientRow
                  key={showAgente ? `${row.clientId}::${row.vendedor ?? idx}` : row.clientId}
                  item={row}
                  vendedor={showAgente ? row.vendedor : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
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
        <PortfolioBody
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
                ? 'Los clientes que este vendedor dé de alta van a aparecer acá, agrupados por antigüedad.'
                : 'Los clientes que des de alta a través de tu vendedor van a aparecer acá, agrupados por antigüedad.'
          }
        />
      ) : null}
    </div>
  );
}
