import { formatDateTime } from '@/utils/formatDate';
import type { SuricataVerdictDto } from '../api/suricataClient';
import styles from './SuricataAiAnalysisTab.module.css';

interface Props {
  /** Ordered newest → oldest — `verdicts[0]` is the current one (design D9). */
  verdicts: SuricataVerdictDto[];
}

function VerdictCard({ verdict, isCurrent }: { verdict: SuricataVerdictDto; isCurrent: boolean }) {
  return (
    <article className={`${styles.card} ${verdict.resuelto ? styles.ok : styles.fail}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.pill} ${verdict.resuelto ? styles.pillOk : styles.pillFail}`}>
          {verdict.resuelto ? 'Resuelto solo' : 'No pudo resolver'}
        </span>
        {isCurrent && <span className={styles.currentTag}>Vigente</span>}
        {/* D9 — a stale verdict is never hidden: the observation was valid for
            that ticket state, it just no longer matches the CURRENT content. */}
        {verdict.stale && (
          <span className={styles.staleTag} role="status">
            Hay mensajes nuevos desde este análisis
          </span>
        )}
      </div>
      <time className={styles.timestamp} dateTime={verdict.createdAt}>
        {formatDateTime(verdict.createdAt)}
      </time>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Análisis</span>
        <p className={styles.fieldText}>{verdict.analisis}</p>
      </div>

      {!verdict.resuelto && (
        <>
          <div className={`${styles.field} ${styles.failReason}`}>
            <span className={styles.fieldLabel}>Motivo por el que no resolvió solo</span>
            <p className={styles.fieldText}>{verdict.motivo ?? '—'}</p>
          </div>
          <div className={`${styles.field} ${styles.suggested}`}>
            <span className={styles.fieldLabel}>Qué deberíamos haber contestado</span>
            <p className={styles.fieldText}>{verdict.respuestaSugerida ?? '—'}</p>
          </div>
        </>
      )}
    </article>
  );
}

/**
 * SuricataAiAnalysisTab — UI-4: current verdict + the FULL history (not just
 * the latest), most recent first, per the explicit task instruction and the
 * BE contract's own ordering guarantee (`verdicts[0]` is current, D9).
 */
export function SuricataAiAnalysisTab({ verdicts }: Props) {
  if (verdicts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Este ticket todavía no recibió un veredicto del bot.</p>
      </div>
    );
  }

  return (
    <div className={styles.list} role="list" aria-label="Historial de veredictos del bot">
      {verdicts.map((verdict, index) => (
        <div key={verdict.id} role="listitem">
          <VerdictCard verdict={verdict} isCurrent={index === 0} />
        </div>
      ))}
    </div>
  );
}
