import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'noc-alerts-hub-enabled';

/**
 * Card del flag `noc-alerts-hub-enabled` (change `noc-alerts-config`, Fase F FE)
 * para AlertsConfigPage → sección "Feature flags" (patrón EXACTO de
 * RadiusAutoCureCard/UispSyncCard: mismo CSS module por composición, mismos
 * hooks). Hoy el flag solo se puede prender desde la DB — sin esta card es
 * INVISIBLE para el usuario.
 *
 * Este es el kill-switch RAÍZ del hub: prender persiste alertas ingresadas +
 * habilita el panel `/admin/alerts` + el stream SSE. Apagar NO borra nada de
 * lo ya guardado, pero corta la ingesta/panel/stream — las fuentes (Grafana,
 * fiber-collector) siguen mandando alertas al ingest endpoint, pero dejan de
 * verse en ningún lado hasta reactivarlo.
 *
 * TANTO el ON como el OFF piden confirmación (useConfirm, tone danger): con
 * el hub apagado, el equipo NOC queda a ciegas de nuevas alertas de fibra
 * mientras dure — ninguna dirección es inocua.
 *
 * Flag gate: admin.flags (mismo criterio que las cards de flags vecinas).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza (mismo criterio que sus hermanas: apagar esto a
 * ciegas dejaría al NOC sin alertas sin que nadie lo sepa).
 */
export function NocAlertsHubEnabledCard() {
  const {
    data: flagData,
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFlag,
  } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();
  const confirm = useConfirm();

  if (flagLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  if (flagError) {
    return (
      <div className={styles.section}>
        <section className={styles.statusCard}>
          <header className={styles.statusHeader}>
            <h2 className={styles.statusTitle}>Hub de alertas NOC</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudo leer el estado del hub.</span> Reintentá.
            </span>
            <button type="button" className={styles.btnRetry} onClick={() => refetchFlag()}>
              Reintentar
            </button>
          </div>
        </section>
      </div>
    );
  }

  const enabled = flagData?.enabled ?? false;

  async function handleFlagToggle() {
    if (!enabled) {
      const ok = await confirm({
        title: 'Activar el hub de alertas NOC',
        message:
          'Este es el kill-switch raíz: prender persiste las alertas que lleguen (Grafana, ' +
          'fiber-collector), habilita el panel "/admin/alerts" y el stream en vivo (SSE). ' +
          '¿Activarlo ahora?',
        confirmLabel: 'Activar hub',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar el hub de alertas NOC',
      message:
        'Al apagarlo, el equipo NOC deja de ver alertas nuevas de fibra en el panel: las fuentes ' +
        'siguen mandando, pero nadie las va a ver hasta que lo reactives. Lo ya guardado NO se ' +
        'borra. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar hub',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setFlag.mutate({ key: FLAG_KEY, enabled: false });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Hub de alertas NOC</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Kill-switch raíz del hub: prendido, las alertas ingresadas quedan <strong>persistidas</strong> y
          visibles en el panel <strong>&quot;Alertas NOC&quot;</strong> con stream en vivo (SSE). Apagado,
          las fuentes siguen mandando pero nada llega a verse hasta reactivarlo.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar hub' : 'Activar hub'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar hub de alertas NOC' : 'Activar hub de alertas NOC'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del hub.</span> Reintentá en
            unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
