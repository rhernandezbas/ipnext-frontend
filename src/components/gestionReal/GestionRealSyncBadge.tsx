import type { GestionRealSyncStatus } from '@/api/gestionReal.api';
import styles from './GestionRealSyncBadge.module.css';

interface Props {
  status: GestionRealSyncStatus | undefined;
  isError: boolean;
}

/** Relative "hace X" label from an ISO timestamp. */
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/**
 * Presentational badge for the Gestión Real mirror state. Pure — the page owns
 * the hook and passes status/isError down. When the feature is off the status
 * endpoint is unreachable (isError) and the badge renders nothing.
 */
export function GestionRealSyncBadge({ status, isError }: Props) {
  if (isError || !status) return null;

  const failed = status.lastResult?.startsWith('error');

  if (failed) {
    return (
      <span className={`${styles.badge} ${styles.error}`} title={status.lastResult ?? ''}>
        <span className={styles.dot} /> Error de sincronización
      </span>
    );
  }

  if (!status.hasRun) {
    return (
      <span className={`${styles.badge} ${styles.idle}`}>
        <span className={styles.dot} /> Sin sincronizar
      </span>
    );
  }

  return (
    <span className={`${styles.badge} ${styles.live}`} title={`Cursor: ${status.cursor ?? '—'}`}>
      <span className={styles.dot} /> Réplica viva · {status.itemsSynced} clientes · {relativeTime(status.lastRunAt)}
    </span>
  );
}
