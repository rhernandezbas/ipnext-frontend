import { useSuricataKpis } from './hooks/useSuricataTickets';
import styles from './SuricataKpiStrip.module.css';

/**
 * suricata-tickets-mirror (Fase G, task G.4, spec `suricata-tickets-ui` UI-6,
 * design D13) — KPI strip: % resuelto por el bot, % necesitó humano, % sin
 * veredicto y tickets sincronizados hoy. Values come straight from
 * `GET /api/suricata/kpis`; the BE already computed the percentages over
 * `total` (D9) — this component never recomputes them.
 *
 * 4 fetch states (checklist obligatorio): loading skeleton, error+retry,
 * explicit empty (0 tickets mirrored yet — showing 4 cards at 0% would be
 * misleading, not informative), success.
 *
 * The `aria-live` container wraps ALL FOUR states and is mounted on every
 * render. A live region inserted into the DOM already carrying its content
 * announces nothing — the region has to pre-exist the change — so returning it
 * only from the success branch (as this did) meant a KPI refresh was never
 * announced. Only the content inside it swaps between states.
 */
export function SuricataKpiStrip() {
  const { data, isLoading, isError, refetch } = useSuricataKpis();

  return (
    <div aria-live="polite" data-testid="suricata-kpi-live">
      {isLoading && (
        <div className={styles.skeleton} role="status" aria-label="Cargando métricas del bot">
          Cargando métricas…
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.errorBox} role="alert">
          <span>No pudimos cargar las métricas del bot.</span>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && (!data || data.total === 0) && (
        <div className={styles.emptyBox}>
          Sin tickets sincronizados todavía. Las métricas aparecen después del primer sync.
        </div>
      )}

      {!isLoading && !isError && data && data.total > 0 && (
        <div className={styles.strip}>
          <div className={`${styles.card} ${styles.resuelto}`}>
            <span className={styles.label}>Resueltos por el bot</span>
            <span className={styles.value}>{data.resueltoBotPct}%</span>
          </div>
          <div className={`${styles.card} ${styles.humano}`}>
            <span className={styles.label}>Necesitaron humano</span>
            <span className={styles.value}>{data.requiereHumanoPct}%</span>
          </div>
          <div className={`${styles.card} ${styles.sinVeredicto}`}>
            <span className={styles.label}>Sin veredicto todavía</span>
            <span className={styles.value}>{data.sinVeredictoPct}%</span>
          </div>
          <div className={`${styles.card} ${styles.sync}`}>
            <span className={styles.label}>Sincronizados hoy</span>
            <span className={styles.value}>{data.sincronizadosHoy}</span>
          </div>
        </div>
      )}
    </div>
  );
}
