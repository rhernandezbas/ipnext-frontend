import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'iclass-gps-ingest';

/**
 * Card del flag `iclass-gps-ingest` (change `iclass-gps-audit`) para
 * SchedulingSettingsPage → IClass → sub-tab "Rastro GPS". Patrón EXACTO de
 * PppoeAutoMoveCard / NocAlertsHubEnabledCard: mismo CSS module por composición,
 * mismos hooks, mismo gate `admin.flags`.
 *
 * El scheduler (`TeamLocationIngestScheduler`) ya está EN PROD pero dark: re-lee
 * el flag en CADA tick, así que prender/apagar no necesita redeploy. Sin esta
 * card el flag es INVISIBLE y el go-live sólo se puede hacer con un
 * `PATCH /api/admin/feature-flags/iclass-gps-ingest` a mano.
 *
 * A diferencia de sus hermanas (que prenden un sync o un watcher sobre equipos),
 * ESTA hace que el sistema empiece a guardar la ubicación de PERSONAS REALES —
 * los técnicos de las cuadrillas — cada 6 horas, con retención propia de 12
 * meses (`IngestTeamLocations.DEFAULT_RETENTION_MONTHS`). El copy lo dice con
 * esas palabras, sin dramatizar y sin esconderlo: quien la prenda tiene que
 * saber exactamente qué está prendiendo.
 *
 * TANTO el ON como el OFF piden confirmación (useConfirm, tone danger). El OFF
 * no borra nada, pero mientras esté apagado el rastro que IClass elimina a los
 * ~30 días se pierde para siempre: ese período queda sin auditoría posible.
 * Ninguna dirección es inocua.
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza (mismo criterio que sus hermanas). El 404 de
 * flag-sin-seedear no llega acá: useFeatureFlag lo mapea a { enabled: false }
 * sin marcar isError.
 *
 * DEUDA — observabilidad: el BE persiste cada corrida en `TeamLocationIngestRun`
 * (última corrida, puntos nuevos/duplicados/purgados, cuadrillas incompletas),
 * pero HOY no hay ningún endpoint que lo exponga: la tabla sólo la escriben
 * `TeamLocationIngestScheduler` y `PrismaTeamLocationRepository`, y
 * `technicianLocation.routes.ts` no la sirve. Por eso esta card no muestra
 * "última corrida" ni "cuadrillas incompletas" — el modo de falla peligroso de
 * este ingest es el silencioso, así que cuando exista el endpoint corresponde
 * agregarlo acá (statsGrid del mismo CSS module, como UispSyncCard).
 */
export function IClassGpsIngestCard() {
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
            <h2 className={styles.statusTitle}>Ingesta del rastro GPS de cuadrillas</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer el estado de la ingesta.
              </span>{' '}
              Reintentá.
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
        title: 'Activar la ingesta del rastro GPS',
        message:
          'A partir de ahora el sistema va a guardar la ubicación de los técnicos de las ' +
          'cuadrillas —personas reales— cada 6 horas, y la va a conservar 12 meses. Se hace ' +
          'para tener auditoría histórica: IClass borra el rastro a los ~30 días. ' +
          '¿Activarla ahora?',
        confirmLabel: 'Activar ingesta',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar la ingesta del rastro GPS',
      message:
        'Al apagarla dejan de guardarse ubicaciones nuevas. Lo ya acumulado NO se borra, pero ' +
        'el rastro que IClass elimine mientras tanto (a los ~30 días) se pierde para siempre: ' +
        'ese período queda sin auditoría posible. ¿Desactivarla ahora?',
      confirmLabel: 'Desactivar ingesta',
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
          <h2 className={styles.statusTitle}>Ingesta del rastro GPS de cuadrillas</h2>
          {/* role=status + aria-live: el badge es el único acuse de recibo del
              toggle (la mutación no abre toast), así que el flip tiene que ser
              perceptible sin ver la pantalla. */}
          <span
            className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Cada 6 horas trae desde IClass el <strong>rastro GPS de las cuadrillas</strong> y lo
          guarda en Prominense. Existe porque <strong>IClass borra el rastro a los ~30 días</strong>:
          sin esta ingesta no hay <strong>auditoría histórica</strong> posible de dónde estuvo cada
          cuadrilla.
        </p>

        {/* Nota de privacidad — permanente, no un banner de error. Prenderlo no
            es "un sync más": es empezar a acumular ubicación de personas. */}
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="note">
          <span>
            <span className={styles.bannerTitle}>Qué implica prenderlo:</span> el sistema empieza a
            guardar la <strong>ubicación de los técnicos</strong> —personas reales— cada 6 horas,
            con retención propia de <strong>12 meses</strong>. Apagarlo detiene la ingesta, pero{' '}
            <strong>no borra lo ya acumulado</strong>.
          </span>
        </div>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar ingesta' : 'Activar ingesta'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar ingesta' : 'Activar ingesta'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
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
