import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceMotivosBaja } from '@/hooks/useFinanceGrowth';
import { Can } from '@/components/auth/Can';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { formatMoney } from '@/utils/formatMoney';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceMotivoBaja } from '@/types/financeGrowth';
import styles from './FinanceGrowthListPage.module.css';

/**
 * finance-growth-dashboard (Fase 5, item 5.8) — motivos de baja ordenados por
 * `mrrPerdidoArs` (fix-wave-4 🔴3). `bajasSinPrecio` es la señal central: en
 * el estado real de prod HOY, `FinancePlanPrice` está vacía (394/394
 * contratos sin precio) — TODAS las filas leerían `mrrPerdidoArs: 0` y el
 * ranking por plata colapsaría a orden de inserción sin explicación. Esta
 * página lo declara en vez de mostrar un ranking mudo: banner global cuando
 * TODAS las bajas del rango están sin precio, y un badge por fila cuando es
 * parcial.
 */

const money = (v: number) => formatMoney(v, 'ARS');

interface Row extends FinanceMotivoBaja {
  id: string;
}

function MoneyCell({ row }: { row: FinanceMotivoBaja }) {
  const allUnpriced = row.bajas > 0 && row.bajasSinPrecio === row.bajas;
  if (allUnpriced) {
    return (
      <span
        className={styles.unknown}
        title="Ninguna baja de este motivo tiene precio de plan cargado — el monto real puede ser mayor a $0"
      >
        — (sin precio cargado)
      </span>
    );
  }
  return (
    <span>
      {money(row.mrrPerdidoArs)}
      {row.bajasSinPrecio > 0 && (
        <span className={styles.caveat}>
          {row.bajasSinPrecio} de {row.bajas} bajas sin precio — monto real probablemente mayor
        </span>
      )}
    </span>
  );
}

export default function FinanceGrowthMotivosBajaPage() {
  const range = useMemo(() => getDefaultYearMonthRange(6), []);
  const motivos = useFinanceMotivosBaja(range);

  const rows: Row[] = (motivos.data?.motivos ?? []).map((m) => ({ ...m, id: m.motivo }));

  const totalBajas = rows.reduce((sum, r) => sum + r.bajas, 0);
  const totalSinPrecio = rows.reduce((sum, r) => sum + r.bajasSinPrecio, 0);
  const allRowsUnpriced = totalBajas > 0 && totalSinPrecio === totalBajas;
  const partiallyUnpriced = totalSinPrecio > 0 && !allRowsUnpriced;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>Motivos de baja</h1>
        </div>
      </div>
      <p className={styles.subtitle}>
        Ordenado por MRR perdido ({formatYearMonthLabel(range.from)} – {formatYearMonthLabel(range.to)}), no por
        cantidad de bajas — un motivo con pocas bajas de alto valor puede pesar más que uno con muchas bajas baratas.
      </p>

      {motivos.isLoading && (
        <div className={styles.skeletonGrid} role="status" aria-label="Cargando motivos de baja">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} aria-hidden="true" />
          ))}
        </div>
      )}

      {motivos.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar los motivos de baja.</p>
          <button type="button" className={styles.retryBtn} onClick={() => motivos.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {motivos.data && (
        <>
          {allRowsUnpriced && (
            <div className={styles.warningBanner} role="alert">
              <strong>Este ranking no es confiable todavía:</strong> ninguna de las {totalBajas} bajas del rango
              tiene un precio de plan resoluble — todas las filas de abajo muestran "sin precio cargado" en vez de
              $0 a propósito. El orden por plata perdida no significa nada hasta que se carguen precios de plan.{' '}
              <Can permission="finance.manage_costs">
                <Link to="/admin/finance-growth/settings#plan-prices">Cargar precios de plan</Link>
              </Can>
            </div>
          )}

          {partiallyUnpriced && (
            <div className={styles.infoBanner} role="status">
              {totalSinPrecio} de {totalBajas} bajas del rango no tienen precio resoluble — las filas afectadas
              muestran una advertencia; su MRR perdido real es probablemente MAYOR al mostrado.
            </div>
          )}

          {rows.length === 0 ? (
            <div className={styles.emptyState}>No hubo bajas en el rango seleccionado.</div>
          ) : (
            <DataTable<Row>
              columns={[
                { label: 'Motivo', key: 'motivo' },
                { label: 'Bajas', key: 'bajas' },
                { label: 'MRR perdido', key: 'mrrPerdidoArs', render: (r) => <MoneyCell row={r} /> },
                { label: 'Sin precio', key: 'bajasSinPrecio', render: (r) => `${r.bajasSinPrecio}/${r.bajas}` },
              ]}
              data={rows}
              loading={false}
              emptyMessage="Sin motivos en este rango."
            />
          )}
        </>
      )}
    </div>
  );
}
