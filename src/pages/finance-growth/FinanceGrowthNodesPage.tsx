import { useMemo } from 'react';
import { useFinanceNodesGrowth } from '@/hooks/useFinanceGrowth';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceNodeGrowth } from '@/types/financeGrowth';
import styles from './FinanceGrowthListPage.module.css';

/**
 * finance-growth-dashboard (Fase 5, item 5.7) — crecimiento neto de
 * contratos por nodo (`networkSiteId`). Los nodos con `netGrowth` negativo
 * se destacan con un chip texto+color ("▼ Contracción") en la celda —
 * NUNCA solo con un tono de fondo, ver regla de a11y del brief ("estado
 * nunca sólo-color"). `networkSiteId: null` (contratos sin nodo asignado) se
 * muestra como fila propia, nunca se pierde del agregado.
 */

interface Row extends FinanceNodeGrowth {
  id: string;
}

function NetGrowthCell({ value }: { value: number }) {
  if (value < 0) {
    return (
      <span className={styles.highlightCell} title="Este nodo perdió más contratos de los que ganó en el rango">
        ▼ {value} (contracción)
      </span>
    );
  }
  if (value > 0) {
    return <span className={[styles.tierGood, styles.primaryMetric].join(' ')}>▲ {value}</span>;
  }
  return <span className={styles.secondaryMetric}>0 (sin cambio)</span>;
}

export default function FinanceGrowthNodesPage() {
  const range = useMemo(() => getDefaultYearMonthRange(6), []);
  const nodes = useFinanceNodesGrowth(range);

  const rows: Row[] = (nodes.data?.nodes ?? []).map((n, idx) => ({
    ...n,
    id: n.networkSiteId ?? `sin-nodo-${idx}`,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>Crecimiento por nodo</h1>
        </div>
      </div>
      <p className={styles.subtitle}>
        Altas y bajas por nodo de red ({formatYearMonthLabel(range.from)} – {formatYearMonthLabel(range.to)}).
      </p>

      {nodes.isLoading && (
        <div className={styles.skeletonGrid} role="status" aria-label="Cargando crecimiento por nodo">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} aria-hidden="true" />
          ))}
        </div>
      )}

      {nodes.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudo cargar el crecimiento por nodo.</p>
          <button type="button" className={styles.retryBtn} onClick={() => nodes.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {nodes.data &&
        (rows.length === 0 ? (
          <div className={styles.emptyState}>No hubo altas ni bajas en el rango seleccionado.</div>
        ) : (
          <DataTable<Row>
            columns={[
              {
                label: 'Nodo',
                key: 'networkSiteName',
                render: (r) => r.networkSiteName ?? <span className={styles.unknown}>Sin nodo asignado</span>,
              },
              { label: 'Altas', key: 'altas' },
              { label: 'Bajas', key: 'bajas' },
              { label: 'Crecimiento neto', key: 'netGrowth', render: (r) => <NetGrowthCell value={r.netGrowth} /> },
            ]}
            data={rows}
            loading={false}
            emptyMessage="Sin nodos en este rango."
          />
        ))}
    </div>
  );
}
