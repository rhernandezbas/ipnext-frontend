import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './IClassSettings.module.css';

const FLAG_KEY = 'iclass-closure-loop';

/**
 * Sub-tab "Cierre de OS" del back office de IClass.
 * Toggle del feature flag `iclass-closure-loop`: cuando está activo, el backend
 * importa las OS cerradas en IClass y mueve la tarea vinculada al estado mapeado
 * para ese resultado (ver sub-tab "Mapeo de resultados"). Mismo patrón que
 * IClassFlagBody: el hook devuelve `enabled: false` si la key no existe (AD-3).
 */
export function IClassClosureFlagBody() {
  const { data, isLoading, isError, refetch } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  if (isLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.tableLoading}>Cargando…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.statusCard}>
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo cargar el estado del cierre automático.</span> Reintentá en unos segundos.</span>
        </div>
        <button className={styles.btnSecondary} onClick={() => refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const enabled = data.enabled;

  function handleToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Cierre automático de OS</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {enabled
            ? 'Cuando una OS se cierra en IClass, la tarea vinculada se mueve automáticamente al estado mapeado para ese resultado de cierre. Configurá los mapeos en la solapa "Mapeo de resultados".'
            : 'El cierre de una OS en IClass no afecta a las tareas locales. Activá para cerrar el loop: las OS cerradas mueven su tarea al estado que mapeaste.'}
        </p>

        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>
            {enabled ? 'Desactivar cierre automático' : 'Activar cierre automático'}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={setFlag.isPending}
              onChange={handleToggle}
              aria-label="Cierre automático de OS de IClass"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo cambiar el estado del cierre automático.</span> Reintentá en unos segundos.</span>
        </div>
      )}
    </div>
  );
}
