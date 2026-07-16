import { useCampaign } from '@/hooks/useBulkMessaging';
import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import { CampaignStatusPill } from '../history/CampaignStatusPill';
import styles from './CampaignHeader.module.css';

interface CampaignHeaderProps {
  campaignId: string;
  /** Fix Wave (MEDIUM-2) — propagado a `useCampaign`; gatea el poll cuando el tab "Historial" no está activo. Default `true`. */
  active?: boolean;
}

/**
 * CampaignHeader (F2 apply chunk 3, HIST-2) — nombre + pill de estado +
 * contadores EN VIVO de `CampaignDetail`. Lee `useCampaign(campaignId)`
 * (chunk 1) SIN `includeRecipients` — el polling ~5s mientras
 * `status === 'running'` (gate `useDocumentVisible`) ya vive ahí y está
 * probado en `useBulkMessaging.test.ts` (MBH-5); acá solo se verifica que
 * los datos se pintan correctamente en las 3 ramas.
 *
 *  1. loading → skeleton (`aria-busy`)
 *  2. error   → mensaje `role="alert"`
 *  3. success → nombre + `CampaignStatusPill` + contadores (`<dl>`) + barra
 *     de progreso (`role="status" aria-live="polite"`, HIST-2) — % sobre
 *     `total` de `sent+failed+skipped+optedOut` (blindado contra total=0).
 */
export function CampaignHeader({ campaignId, active = true }: CampaignHeaderProps) {
  const { data, isLoading, isError } = useCampaign(campaignId, {}, active);

  if (isLoading) {
    return (
      <div className={styles.header} aria-busy="true">
        <Skeleton height={24} width="40%" />
        <Skeleton height={16} width="100%" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className={styles.error} role="alert">
        No se pudo cargar la campaña. Intentá nuevamente.
      </p>
    );
  }

  const c = data.campaign;
  const processed = c.sentCount + c.failedCount + c.skippedCount + c.optedOutCount;
  const progressPct = c.total > 0 ? Math.min(100, Math.round((processed / c.total) * 100)) : 0;

  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h2 className={styles.name}>{c.name}</h2>
        <CampaignStatusPill status={c.status} />
      </div>

      <dl className={styles.counters}>
        <div className={styles.counter}>
          <dt>Total</dt>
          <dd>{c.total}</dd>
        </div>
        <div className={styles.counter}>
          <dt>Enviados</dt>
          <dd>{c.sentCount}</dd>
        </div>
        <div className={styles.counter}>
          <dt>Fallidos</dt>
          <dd>{c.failedCount}</dd>
        </div>
        <div className={styles.counter}>
          <dt>Omitidos</dt>
          <dd>{c.skippedCount}</dd>
        </div>
        <div className={styles.counter}>
          <dt>Opt-out</dt>
          <dd>{c.optedOutCount}</dd>
        </div>
      </dl>

      <div className={styles.progressWrapper} role="status" aria-live="polite">
        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {progressPct}% procesado — {processed} de {c.total}
        </span>
      </div>
    </div>
  );
}
