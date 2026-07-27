import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceCohorts } from '@/hooks/useFinanceGrowth';
import { Can } from '@/components/auth/Can';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceCohort, FinanceCohortSurvivalPoint } from '@/types/financeGrowth';
import styles from './FinanceGrowthListPage.module.css';

/**
 * finance-growth-dashboard (Fase 5, item 5.4) — matriz de supervivencia de
 * cohortes 3/6/12 meses. Implementada como `DataTable` (heatmap por color +
 * el número siempre visible, NUNCA solo color — regla de a11y del brief) en
 * vez de un componente de heatmap dedicado: no existe un átomo de heatmap en
 * el design system y una tabla de 4 columnas (cohorte/m3/m6/m12) ya es una
 * matriz legible sin inventar un componente nuevo.
 *
 * `monthsWithoutCohortSnapshot` (fix-wave-4 🟡9) es la señal central de esta
 * página: distingue "el job de snapshots nunca corrió para este mes" de
 * "no hubo altas ese mes" — sin ella, `cohorts: []` (el estado real de prod
 * hoy) es indistinguible entre ambos casos.
 */

interface CohortRow extends FinanceCohort {
  id: string;
}

function tierFor(pct: number): 'tierGood' | 'tierWarn' | 'tierBad' {
  if (pct >= 80) return 'tierGood';
  if (pct >= 50) return 'tierWarn';
  return 'tierBad';
}

function SurvivalCell({ point, monthsElapsed }: { point: FinanceCohortSurvivalPoint | null; monthsElapsed: number }) {
  if (!point) {
    return (
      <span
        className={styles.unknown}
        title={`Esta cohorte todavía no cumplió ${monthsElapsed} meses de vida — no es un dato faltante, es prematuro`}
      >
        aún no cumple {monthsElapsed}m
      </span>
    );
  }
  return (
    <span className={styles[tierFor(point.pct)]}>
      {point.pct.toFixed(0)}% <span className={styles.secondaryMetric}>({point.survivingCount})</span>
    </span>
  );
}

export default function FinanceGrowthCohortsPage() {
  const range = useMemo(() => getDefaultYearMonthRange(12), []);
  const cohorts = useFinanceCohorts({ fromCohort: range.from, toCohort: range.to });

  const missing = cohorts.data?.monthsWithoutCohortSnapshot ?? [];
  const rows: CohortRow[] = (cohorts.data?.cohorts ?? []).map((c) => ({ ...c, id: c.cohortYearMonth }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>Cohortes</h1>
        </div>
      </div>
      <p className={styles.subtitle}>
        Supervivencia de contratos de internet a 3, 6 y 12 meses de la alta, agrupados por mes de cohorte
        ({formatYearMonthLabel(range.from)} – {formatYearMonthLabel(range.to)}).
      </p>

      {cohorts.isLoading && (
        <div className={styles.skeletonGrid} role="status" aria-label="Cargando cohortes">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} aria-hidden="true" />
          ))}
        </div>
      )}

      {cohorts.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar las cohortes.</p>
          <button type="button" className={styles.retryBtn} onClick={() => cohorts.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {cohorts.data && (
        <>
          {missing.length > 0 && (
            <div className={styles.warningBanner} role="status">
              <strong>Todavía no se calculó</strong> la cohorte de: {missing.map(formatYearMonthLabel).join(', ')}.
              No significa que no hubo altas esos meses — el job nocturno o el backfill histórico no llegaron ahí
              todavía.
            </div>
          )}

          {rows.length === 0 ? (
            <div className={styles.emptyState}>
              <p>
                Ninguna cohorte de este rango fue computada todavía. Es el estado esperado hoy: el job nocturno de
                snapshots recién empieza a correr sobre un backfill de cobranza en curso.
              </p>
              <Can permission="finance.sync">
                <Link to="/admin/finance-growth" className={styles.emptyCta}>
                  Ver estado de sincronización
                </Link>
              </Can>
            </div>
          ) : (
            <DataTable<CohortRow>
              columns={[
                { label: 'Cohorte', key: 'cohortYearMonth', render: (r) => formatYearMonthLabel(r.cohortYearMonth) },
                { label: 'Altas originales', key: 'originalCount' },
                { label: 'Supervivencia 3m', key: 'm3', render: (r) => <SurvivalCell point={r.survival.m3} monthsElapsed={3} /> },
                { label: 'Supervivencia 6m', key: 'm6', render: (r) => <SurvivalCell point={r.survival.m6} monthsElapsed={6} /> },
                { label: 'Supervivencia 12m', key: 'm12', render: (r) => <SurvivalCell point={r.survival.m12} monthsElapsed={12} /> },
              ]}
              data={rows}
              loading={false}
              emptyMessage="Sin cohortes en este rango."
            />
          )}
        </>
      )}
    </div>
  );
}
