import { Link } from 'react-router-dom';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useMyPortfolio } from '@/hooks/usePortfolio';
import { AGE_BUCKETS, AGE_BUCKET_LABELS } from '@/types/portfolio';
import type { PortfolioItem } from '@/types/portfolio';
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
}

function ClientRow({ item }: ClientRowProps) {
  const inner = (
    <>
      <span className={styles.clientName}>{item.clientName}</span>
      <span className={styles.clientMeta}>
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
    </>
  );

  return (
    <Link to={`/admin/customers/view/${item.clientId}`} className={styles.clientRow}>
      {inner}
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MisClientesPage() {
  const { data, isLoading, isError, refetch, isFetching } = useMyPortfolio();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Clientes /</span>
          <h1 className={styles.title}>Mis clientes</h1>
        </div>
        {data && !data.unmapped ? (
          <div className={styles.headerRight}>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
              Actualizar
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className={styles.centered} aria-label="Cargando cartera">
          <Spinner />
        </div>
      ) : isError ? (
        <div className={styles.stateBox} role="alert">
          <p className={styles.stateTitle}>No se pudo cargar tu cartera</p>
          <p className={styles.stateText}>Revisá tu conexión e intentá de nuevo.</p>
          <Button variant="primary" size="md" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data?.unmapped ? (
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
      ) : data && data.items.length === 0 ? (
        <div className={styles.stateBox}>
          <p className={styles.stateTitle}>Todavía no tenés clientes en tu cartera</p>
          <p className={styles.stateText}>
            Los clientes que des de alta a través de tu vendedor van a aparecer acá,
            agrupados por antigüedad.
          </p>
        </div>
      ) : data ? (
        <>
          <SummaryCards
            total={data.summary.total}
            active={data.summary.active}
            withDebt={data.summary.withDebt}
            withClaims={data.summary.withClaims}
          />

          {AGE_BUCKETS.map((bucket) => {
            const clients = data.items.filter((it) => it.ageBucket === bucket);
            if (clients.length === 0) return null;
            return (
              <section key={bucket} className={styles.bucketSection} aria-label={AGE_BUCKET_LABELS[bucket]}>
                <header className={styles.bucketHeader}>
                  <h2 className={styles.bucketTitle}>{AGE_BUCKET_LABELS[bucket]}</h2>
                  <span className={styles.bucketCount}>{data.summary.byBucket[bucket]}</span>
                </header>
                <div className={styles.clientList}>
                  {clients.map((item) => (
                    <ClientRow key={item.clientId} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
