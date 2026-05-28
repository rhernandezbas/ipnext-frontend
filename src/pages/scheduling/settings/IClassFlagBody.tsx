import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './IClassSettings.module.css';

const FLAG_KEY = 'iclass-integration';

/**
 * Sub-tab "Integración" del back office de IClass.
 * Status card con badge de estado + descripción contextual + acción visible
 * (switch). El hook devuelve `enabled: false` si la key no existe en DB (AD-3),
 * así que solo manejamos loading / network-error / data.
 */
export function IClassFlagBody() {
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
          <span><span className={styles.bannerTitle}>No se pudo cargar el estado de la integración.</span> Reintentá en unos segundos.</span>
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
          <h2 className={styles.statusTitle}>Integración con IClass</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {enabled
            ? 'Las tareas que pases a la etapa "Enviar a IClass" crearán órdenes de servicio en el panel IClass usando el tipo de OS configurado para cada proyecto.'
            : 'Las tareas que pases a la etapa "Enviar a IClass" sólo cambian de etapa. No se envía nada al panel IClass.'}
        </p>

        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>
            {enabled ? 'Desactivar integración' : 'Activar integración'}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={setFlag.isPending}
              onChange={handleToggle}
              aria-label="Integración con IClass"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo cambiar el estado de la integración.</span> Reintentá en unos segundos.</span>
        </div>
      )}
    </div>
  );
}
