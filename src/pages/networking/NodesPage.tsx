import { useUispSyncStatus, useTriggerUispSync } from '@/hooks/useUispSyncStatus';
import { Can } from '@/components/auth/Can';
import { formatSyncDate } from '@/lib/uisp';
import { UispNodesList } from '@/components/networking/UispNodesList';
import styles from './NodesPage.module.css';

export default function NodesPage() {
  const { data: syncStatus } = useUispSyncStatus();
  const triggerSync = useTriggerUispSync();

  function handleSync() {
    triggerSync.mutate(undefined as never);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Nodos UISP</h1>
          {syncStatus && (
            <span className={styles.syncMeta}>
              Última sync: {formatSyncDate(syncStatus.lastRunAt)}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <Can permission="uisp.manage">
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSync}
              disabled={triggerSync.isPending}
              aria-label="Sincronizar ahora"
            >
              {triggerSync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </Can>
        </div>
      </div>

      {triggerSync.isSuccess && triggerSync.data && !triggerSync.data.queued && (
        <div className={styles.banner}>
          {triggerSync.data.reason === 'already-running'
            ? 'El sync ya está en ejecución, esperá que termine.'
            : 'El sync está desactivado. Activá el flag uisp-sync para ejecutarlo.'}
        </div>
      )}

      <UispNodesList />
    </div>
  );
}
