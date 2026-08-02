import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import type { AudiencePreviewOutput } from '@/api/promos.api';
import styles from './PromoAudiencePreviewPanel.module.css';

interface PromoAudiencePreviewPanelProps {
  /** `hasSegmentCriteria(segment)` (reusado de Bulk Messaging) — sin esto no tiene sentido pedir preview. */
  hasCriteria: boolean;
  isPending: boolean;
  isError: boolean;
  data: AudiencePreviewOutput | undefined;
  onRetry: () => void;
}

const PANEL_HEADING_ID = 'promo-audience-heading';

/**
 * PromoAudiencePreviewPanel (promos-admin) — el panel MÁS IMPORTANTE de esta
 * pantalla (decisión explícita del proposal): muestra los DOS números que
 * devuelve `/api/promos/audience-preview` — `segmentCount` (a cuántos
 * clientes matchea el segmento) Y, DESTACADO, `withAppCount` (a cuántos les
 * llega DE VERDAD — sólo esos VEN la promo en la app). `withAppCount` es el
 * único honesto: hoy puede decir 1, y hay que MOSTRARLO así, sin esconderlo
 * ni suavizarlo (regla dura del proposal). `withAppCount === 0` muestra una
 * advertencia EXPLÍCITA en vez de un simple "0" — el operador tiene que
 * entender que NADIE va a ver esa promo, no adivinarlo de un número pelado.
 *
 * NO reusa `SegmentPreviewPanel` de Bulk Messaging tal cual: ese panel está
 * atado al shape `PreviewSegmentOutput` (count/sample/skipped/statusCounts —
 * pensado para depurar destinatarios de un ENVÍO), mientras que acá el
 * contrato del BE es `{segmentCount, withAppCount}` — dos números con
 * semántica propia (audiencia total vs. audiencia REAL con la app), sin
 * sample ni desglose. Forzar el shape de uno en el otro sería más frágil que
 * un componente chico propio — SÍ se reusa la lógica compartible real:
 * `hasSegmentCriteria`/`hasIneffectiveBalance` (`segmentCriteria.ts`) y el
 * átomo `Skeleton`, ambos importados tal cual desde Bulk Messaging.
 *
 * 4 ramas (un escalón menos que `SegmentPreviewPanel`: acá el preview es
 * AUTOMÁTICO por debounce, sin botón "Ver preview" — no existe el estado
 * "hay criterio pero no se pidió todavía"):
 *  1. !hasCriteria          → nota "elegí un criterio"
 *  2. hasCriteria+isPending → skeleton "calculando…"
 *  3. hasCriteria+isError   → role=alert + reintentar
 *  4. hasCriteria+data      → los dos números (withAppCount destacado);
 *     `withAppCount === 0` es su propia sub-rama (role=alert, advertencia explícita)
 */
export function PromoAudiencePreviewPanel({ hasCriteria, isPending, isError, data, onRetry }: PromoAudiencePreviewPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={PANEL_HEADING_ID} aria-busy={isPending}>
      <h2 id={PANEL_HEADING_ID} className={styles.title}>
        Audiencia
      </h2>

      {!hasCriteria && (
        <p className={styles.notice} role="status">
          Elegí al menos un criterio de segmento para ver a cuántos clientes les llega esta promoción.
        </p>
      )}

      {hasCriteria && isPending && (
        <div className={styles.loading}>
          <p className={styles.srOnlyStatus} role="status">
            Calculando audiencia…
          </p>
          <Skeleton height={20} />
          <Skeleton height={36} width="60%" />
        </div>
      )}

      {hasCriteria && !isPending && isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>No se pudo calcular la audiencia. Reintentá.</p>
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}

      {hasCriteria && !isPending && !isError && data && (
        <div className={styles.results}>
          <p className={styles.segmentCount}>
            Segmento: <strong>{data.segmentCount.toLocaleString('es-AR')}</strong>{' '}
            cliente{data.segmentCount === 1 ? '' : 's'}
          </p>

          {data.withAppCount === 0 ? (
            <p className={styles.withAppZero} role="alert">
              Con la app instalada: <strong>0</strong> — nadie con la app entra en este segmento, no la va a ver
              ningún cliente.
            </p>
          ) : (
            <p className={styles.withAppCount} aria-live="polite">
              <span className={styles.withAppLabel}>Con la app instalada</span>
              <strong>{data.withAppCount.toLocaleString('es-AR')}</strong>
              <span className={styles.withAppHint}>
                ← est{data.withAppCount === 1 ? 'e cliente ve' : 'os son los que ven'} la promo
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
