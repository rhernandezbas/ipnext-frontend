import { Can } from '@/components/auth/Can';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'radius-auth-ingest';

/**
 * RADIUS Auth Ingest card for NetworkingSettingsPage → sección RADIUS.
 * Permite activar/desactivar la ingesta de los intentos de autenticación
 * (Access-Reject/Accept) del RADIUS (~5 minutos por corrida) — expuesta en
 * /admin/networking/audit (tab "Errores de auth").
 *
 * Flag gate: admin.flags (solo lectura sin el permiso — toggle oculto).
 * Clona el patrón de RadiusAccountingCard (misma estructura, mismo CSS, mismos hooks).
 */
export function RadiusAuthIngestCard() {
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
          <h2 className={styles.statusTitle}>Ingesta de errores de auth RADIUS</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Cuando está activa, el sistema ingesta los intentos de autenticación
          (Access-Reject/Accept) del RADIUS cada ~5 minutos. Los datos quedan disponibles en el tab{' '}
          <strong>Errores de auth</strong>.{' '}
          Tras activarla, tardan unos minutos en aparecer.
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
                  aria-label="Ingesta de errores de auth RADIUS automática"
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
