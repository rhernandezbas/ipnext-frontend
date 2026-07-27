import { useMemo } from 'react';
import { useFinanceVendorsEarlyChurn } from '@/hooks/useFinanceGrowth';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceVendorEarlyChurn } from '@/types/financeGrowth';
import styles from './FinanceGrowthListPage.module.css';

/**
 * finance-growth-dashboard (Fase 5, item 5.6) — ranking de vendedores por
 * churn temprano. `earlyChurnPct` es la columna PRIMARIA a propósito
 * (jerarquía visual INVERTIDA respecto de un ranking de ventas tradicional
 * por volumen — ver design.md "FE — campo por campo"): un ranking por
 * `altasTotal` premia justo al vendedor cuyas altas se caen a los 2 meses.
 * `altasMaduras` (fix-wave-4 🟡5) es el denominador REAL de `earlyChurnPct` —
 * `earlyChurnPct: null` (sin altas maduras todavía) se muestra como "sin
 * datos", NUNCA como 0% (que premiaría a un vendedor con ventas de la semana
 * pasada exactamente igual que a uno con historial limpio comprobado).
 *
 * El orden que trae el BE (DESC por earlyChurnPct, nulls al final) NO se
 * reordena con el sort de `DataTable` — es la garantía central del endpoint,
 * reordenarla localmente por otra columna (ej. clickear "Altas totales")
 * reintroduciría el sesgo por volumen que este ranking existe para evitar.
 */

const pct = (v: number) => `${v.toFixed(1)}%`;

interface Row extends FinanceVendorEarlyChurn {
  id: string;
}

function tierFor(p: number): 'tierGood' | 'tierWarn' | 'tierBad' {
  if (p <= 10) return 'tierGood';
  if (p <= 30) return 'tierWarn';
  return 'tierBad';
}

function EarlyChurnCell({ vendor }: { vendor: FinanceVendorEarlyChurn }) {
  if (vendor.earlyChurnPct === null) {
    return (
      <span
        className={[styles.primaryMetric, styles.unknown].join(' ')}
        title="Sin altas maduras todavía — ninguna alta de este vendedor cerró aún la ventana de churn temprano"
      >
        sin datos aún
      </span>
    );
  }
  return (
    <span className={[styles.primaryMetric, styles[tierFor(vendor.earlyChurnPct)]].join(' ')}>
      {pct(vendor.earlyChurnPct)}
    </span>
  );
}

export default function FinanceGrowthVendorsPage() {
  const range = useMemo(() => getDefaultYearMonthRange(6), []);
  const vendors = useFinanceVendorsEarlyChurn(range);

  const rows: Row[] = (vendors.data?.vendors ?? []).map((v) => ({ ...v, id: v.vendedor }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>Ranking de vendedores</h1>
        </div>
      </div>
      <p className={styles.subtitle}>
        Churn temprano por vendedor ({formatYearMonthLabel(range.from)} – {formatYearMonthLabel(range.to)}). Ordenado
        por tasa de churn temprano, no por volumen de ventas — es el punto de esta métrica.
      </p>

      {vendors.isLoading && (
        <div className={styles.skeletonGrid} role="status" aria-label="Cargando ranking de vendedores">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} aria-hidden="true" />
          ))}
        </div>
      )}

      {vendors.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudo cargar el ranking de vendedores.</p>
          <button type="button" className={styles.retryBtn} onClick={() => vendors.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {vendors.data && (
        <>
          <p className={styles.infoBanner} role="status">
            Ventana de "temprano": {vendors.data.windowMonths} meses desde la fecha real de la alta (no desde el 1°
            del mes calendario).
          </p>

          {rows.length === 0 ? (
            <div className={styles.emptyState}>No hay altas nuevas en el rango seleccionado.</div>
          ) : (
            <DataTable<Row>
              columns={[
                { label: 'Vendedor', key: 'vendedor' },
                {
                  label: 'Churn temprano',
                  key: 'earlyChurnPct',
                  render: (r) => <EarlyChurnCell vendor={r} />,
                },
                {
                  label: 'Altas maduras',
                  key: 'altasMaduras',
                  render: (r) => <span className={styles.secondaryMetric}>{r.altasMaduras}</span>,
                },
                {
                  label: 'Churneadas temprano',
                  key: 'altasChurneadasTemprano',
                  render: (r) => <span className={styles.secondaryMetric}>{r.altasChurneadasTemprano}</span>,
                },
                {
                  label: 'Altas totales',
                  key: 'altasTotal',
                  render: (r) => <span className={styles.secondaryMetric}>{r.altasTotal}</span>,
                },
              ]}
              data={rows}
              loading={false}
              emptyMessage="Sin vendedores en este rango."
            />
          )}
        </>
      )}
    </div>
  );
}
