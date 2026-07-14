import { Button } from '@/components/atoms/Button/Button';
import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import type { PreviewSegmentOutput } from '@/types/messagingBulk';
import styles from './SegmentPreviewPanel.module.css';

interface SegmentPreviewPanelProps {
  /** `hasSegmentCriteria(segment)` — sin esto no tiene sentido pedir/mostrar preview. */
  hasCriteria: boolean;
  isPending: boolean;
  isError: boolean;
  data: PreviewSegmentOutput | undefined;
  onRefresh: () => void;
}

const PANEL_HEADING_ID = 'bulk-preview-heading';

/**
 * SegmentPreviewPanel (F2 apply chunk 2, SEG-1..SEG-4) — columna derecha del
 * composer. Presentacional puro: recibe el resultado de `usePreviewSegment`
 * ya resuelto por `CampaignComposer` (que dispara `preview()` automático con
 * debounce ~500ms al cambiar el segmento, además del botón manual de acá).
 *
 * 5 ramas (más que las 4 de F1 porque el ciclo de vida de una MUTATION
 * on-demand tiene un estado extra: "hay criterio pero todavía no se pidió
 * preview" — distinto de loading real):
 *  1. !hasCriteria           → nota "elegí un criterio"
 *  2. hasCriteria+isPending  → skeleton "calculando…"
 *  3. hasCriteria+isError    → mensaje role=alert + botón para reintentar
 *  4. hasCriteria+sin data   → nota neutra ("todavía no se calculó")
 *  5. hasCriteria+data       → resultado (count/skipped/sample), `count===0`
 *     es su propia sub-rama (role=alert — bloquea "Crear campaña", CAMPAIGN
 *     spec EMPTY_SEGMENT)
 */
export function SegmentPreviewPanel({ hasCriteria, isPending, isError, data, onRefresh }: SegmentPreviewPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={PANEL_HEADING_ID} aria-busy={isPending}>
      <div className={styles.header}>
        <h2 id={PANEL_HEADING_ID} className={styles.title}>
          Preview del segmento
        </h2>
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={!hasCriteria || isPending}>
          Ver preview
        </Button>
      </div>

      {!hasCriteria && (
        <p className={styles.notice} role="status">
          Elegí al menos un criterio de segmento para ver el preview.
        </p>
      )}

      {hasCriteria && isPending && (
        <div className={styles.loading}>
          <p className={styles.srOnlyStatus} role="status">
            Calculando destinatarios…
          </p>
          <Skeleton height={20} />
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="50%" />
        </div>
      )}

      {hasCriteria && !isPending && isError && (
        <p className={styles.error} role="alert">
          No se pudo calcular el preview del segmento. Reintentá.
        </p>
      )}

      {hasCriteria && !isPending && !isError && !data && (
        <p className={styles.notice} role="status">
          Hacé click en &quot;Ver preview&quot; para calcular los destinatarios.
        </p>
      )}

      {hasCriteria && !isPending && !isError && data && (
        <div className={styles.results}>
          {data.count === 0 ? (
            <p className={styles.emptyResult} role="alert">
              0 destinatarios — revisá el segmento.
            </p>
          ) : (
            // FIX-7a — live region: el conteo se anuncia al recalcularse el preview.
            <p className={styles.count} aria-live="polite">
              <strong>{data.count}</strong> destinatario{data.count === 1 ? '' : 's'} recibirán el mensaje
            </p>
          )}

          {(data.skipped.optedOut > 0 || data.skipped.duplicatePhone > 0 || data.skipped.invalidPhone > 0) && (
            <ul className={styles.skippedList} aria-label="Excluidos del envío">
              {data.skipped.optedOut > 0 && (
                <li>
                  Optaron por no recibir mensajes: {data.skipped.optedOut}
                </li>
              )}
              {data.skipped.duplicatePhone > 0 && (
                <li>
                  Teléfono duplicado (colapsado): {data.skipped.duplicatePhone}
                </li>
              )}
              {data.skipped.invalidPhone > 0 && (
                <li>
                  Teléfono ausente o inválido: {data.skipped.invalidPhone}
                </li>
              )}
            </ul>
          )}

          {data.sample.length > 0 && (
            <div className={styles.sample}>
              <h3 className={styles.sampleTitle}>Muestra</h3>
              <ul>
                {data.sample.map((s) => (
                  <li key={s.clientId}>{s.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
