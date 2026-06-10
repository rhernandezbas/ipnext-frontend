import { Can } from '@/components/auth/Can';
import { useUispSyncStatus, useTriggerUispSync } from '@/hooks/useUispSyncStatus';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { formatSyncDate } from '@/lib/uisp';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'uisp-sync';

/**
 * UISP Sync card for the Settings → Integraciones tab.
 * Shows sync status (lastRunAt, counts) + flag toggle (admin.flags gate) +
 * "Sincronizar ahora" button (uisp.manage gate).
 *
 * Mirrors the IClassFlagBody / AutomationsBody flag-toggle pattern.
 */
export function UispSyncCard() {
  const { data: syncStatus, isLoading: syncLoading } = useUispSyncStatus();
  const { data: flagData, isLoading: flagLoading, isError: flagError } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();
  const triggerSync = useTriggerUispSync();

  const isLoading = syncLoading || flagLoading;

  if (isLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  // ── Not configured state ───────────────────────────────────────────────
  if (syncStatus && !syncStatus.configured) {
    return (
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Sincronización UISP</h2>
          <span className={`${styles.statusBadge} ${styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            UISP no configurado
          </span>
        </header>
        <p className={styles.statusDescription}>
          Configurá las variables de entorno <code>UISP_BASE_URL</code> y <code>UISP_TOKEN</code> en el
          servidor para habilitar la integración con UISP.
        </p>
      </section>
    );
  }

  const enabled = flagData?.enabled ?? false;
  const hasRun = !!(syncStatus?.lastRunAt);

  function handleFlagToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  function handleTriggerSync() {
    triggerSync.mutate(undefined as never);
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Sincronización UISP</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        {/* ── Last error banner (FIX-2b) ──────────────────────────────── */}
        {hasRun && syncStatus?.lastError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>Último sync falló:</span>{' '}
              {syncStatus.lastError}
            </span>
          </div>
        )}

        {/* ── Sync stats ─────────────────────────────────────────────── */}
        {hasRun && syncStatus ? (
          <dl className={styles.statsGrid}>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Sitios</dt>
              <dd className={styles.statValue}>{syncStatus.sites ?? '—'}</dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Equipos</dt>
              <dd className={styles.statValue}>{syncStatus.devices ?? '—'}</dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Faltantes</dt>
              <dd className={styles.statValue}>{syncStatus.missing ?? '—'}</dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Último sync</dt>
              <dd className={styles.statValue}>{formatSyncDate(syncStatus.lastRunAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.statusDescription}>
            El sync nunca fue ejecutado. Activá el flag para que corra automáticamente cada 5 minutos.
          </p>
        )}

        {/* ── Flag toggle (admin.flags gate) ─────────────────────────── */}
        {!flagError && (
          <Can permission="admin.flags">
            <div className={styles.statusActionRow}>
              <span className={styles.statusActionLabel}>
                {enabled ? 'Desactivar sync automático' : 'Activar sync automático'}
              </span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={setFlag.isPending}
                  onChange={handleFlagToggle}
                  aria-label="Sincronización UISP automática"
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </label>
            </div>
          </Can>
        )}

        {/* ── Trigger button (uisp.manage gate) ─────────────────────── */}
        <Can permission="uisp.manage">
          <div className={styles.triggerRow}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleTriggerSync}
              disabled={triggerSync.isPending}
              aria-label="Sincronizar ahora"
            >
              {triggerSync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>

            {triggerSync.isSuccess && triggerSync.data && !triggerSync.data.queued && (
              <p className={styles.triggerReason}>
                {triggerSync.data.reason === 'already-running'
                  ? 'El sync ya está en ejecución, esperá que termine.'
                  : 'El sync está desactivado. Activá el flag para ejecutarlo.'}
              </p>
            )}

            {triggerSync.isSuccess && triggerSync.data?.queued && (
              <p className={styles.triggerSuccess}>
                Sync encolado correctamente.
              </p>
            )}
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del sync.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}

      {triggerSync.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>Error al disparar el sync.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
