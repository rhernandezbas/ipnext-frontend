import { useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  useReportsOverview,
  useReportsTraffic,
  useReportsResolutions,
} from '@/hooks/useMessagingReports';
import type { ReportsDateRange } from '@/types/messagingReports';
import { RangeSelector } from './components/RangeSelector';
import { OverviewTiles } from './components/OverviewTiles';
import { TrafficHeatmap } from './components/TrafficHeatmap';
import { ResolutionsChart } from './components/ResolutionsChart';
import { presetRange, type RangePreset } from './lib/range';
import styles from './WhatsappReportsPage.module.css';

/** Skeleton + error+retry compartidos por cada sección/fetch. `empty` lo
 * resuelve cada componente hijo (heatmap/bars/tiles) — acá viven las ramas
 * loading y error (role=alert reintentable). */
function SectionBody<T>({
  query,
  render,
}: {
  query: UseQueryResult<T, Error>;
  render: (data: T) => ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div
        className={styles.skeleton}
        data-testid="reports-skeleton"
        role="status"
        aria-label="Cargando informe"
      />
    );
  }
  if (query.isError) {
    return (
      <div className={styles.error} role="alert">
        <p className={styles.errorText}>No se pudo cargar. Intentá nuevamente.</p>
        <button type="button" className={styles.retryBtn} onClick={() => void query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (query.data == null) return null;
  return <>{render(query.data)}</>;
}

/**
 * WhatsappReportsPage (Ola 3 — dashboard Reports Overview) — página de Informes
 * del dominio Comunicaciones (WhatsApp). Gate `messaging.read` en la ruta
 * (`RequirePermission`). Selector de rango (7/30 días + custom, default 7d) que
 * setea `from/to` (medianoche AR → UTC) y refetchea los 3 fetches al cambiar.
 *
 * Tres bloques: tiles de conversaciones abiertas (current* en vivo) + resueltas/
 * creadas del rango, heatmap de tráfico (día×hora, hora AR) y resoluciones por
 * día. Cada fetch tiene sus 4 ramas: loading (skeleton) / error (alert+retry) al
 * nivel de la sección, y empty / success dentro del componente.
 */
export default function WhatsappReportsPage() {
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [range, setRange] = useState<ReportsDateRange>(() => presetRange('7d'));

  const overview = useReportsOverview(range);
  const traffic = useReportsTraffic(range);
  const resolutions = useReportsResolutions(range);

  function handleRange(nextPreset: RangePreset, nextRange: ReportsDateRange) {
    setPreset(nextPreset);
    setRange(nextRange);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>WhatsApp /</span>
          <h1 className={styles.title}>Informes</h1>
          <p className={styles.subtitle}>
            Métricas del inbox por rango. Horas en hora local de Buenos Aires.
          </p>
        </div>
        <RangeSelector preset={preset} onChange={handleRange} />
      </div>

      <section className={styles.section} aria-labelledby="reports-overview-h">
        <h2 id="reports-overview-h" className={styles.sectionTitle}>
          Conversaciones
        </h2>
        <SectionBody query={overview} render={(data) => <OverviewTiles overview={data} />} />
      </section>

      <section className={styles.section} aria-labelledby="reports-traffic-h">
        <h2 id="reports-traffic-h" className={styles.sectionTitle}>
          Tráfico por hora
        </h2>
        <SectionBody query={traffic} render={(data) => <TrafficHeatmap traffic={data} />} />
      </section>

      <section className={styles.section} aria-labelledby="reports-resolutions-h">
        <h2 id="reports-resolutions-h" className={styles.sectionTitle}>
          Resoluciones por día
        </h2>
        <SectionBody
          query={resolutions}
          render={(data) => <ResolutionsChart range={range} resolutions={data} />}
        />
      </section>
    </div>
  );
}
