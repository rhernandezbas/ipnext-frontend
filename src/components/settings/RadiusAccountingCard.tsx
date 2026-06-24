import { Can } from '@/components/auth/Can';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'radius-accounting-ingest';

/**
 * RADIUS Accounting Ingest card for NetworkingSettingsPage → sección RADIUS.
 * Permite activar/desactivar la ingesta del historial de conexión/desconexión PPPoE
 * desde el RADIUS (~5 minutos por corrida) — expuesto en /admin/networking/audit
 * (tabs "Logs RADIUS" y "Auditoría NE8000").
 *
 * Flag gate: admin.flags (solo lectura sin el permiso — toggle oculto).
 * Clona el patrón de UispSyncCard (misma estructura, mismo CSS, mismos hooks).
 */
export function RadiusAccountingCard() {
  const { data: flagData, isLoading: flagLoading, isError: flagError } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  if (flagLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  const enabled = flagData?.enabled ?? false;

  function handleFlagToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Ingesta de auditoría RADIUS</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Cuando está activa, el sistema ingesta el historial de conexión/desconexión PPPoE del RADIUS
          cada ~5 minutos. Los datos quedan disponibles en{' '}
          <strong>Logs RADIUS</strong> y <strong>Auditoría NE8000</strong>.{' '}
          Tras activarla, los datos tardan unos minutos en aparecer (primera corrida del scheduler).
        </p>

        {/* ── Flag toggle (admin.flags gate) ─────────────────────────── */}
        {!flagError && (
          <Can permission="admin.flags">
            <div className={styles.statusActionRow}>
              <span className={styles.statusActionLabel}>
                {enabled ? 'Desactivar ingesta automática' : 'Activar ingesta automática'}
              </span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={setFlag.isPending}
                  onChange={handleFlagToggle}
                  aria-label="Ingesta de auditoría RADIUS automática"
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </label>
            </div>
          </Can>
        )}
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado de la ingesta.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
