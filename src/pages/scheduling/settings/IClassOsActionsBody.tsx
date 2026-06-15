import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import styles from './IClassSettings.module.css';

const CLOSE_FLAG = 'iclass-close-action';
const ASSIGN_FLAG = 'iclass-assign-action';

/**
 * Sub-tab "Acciones de OS" — dos toggles de feature flags que habilitan
 * escrituras reales a IClass al cerrar/asignar órdenes de servicio.
 *
 * ⚠ Ambas acciones disparan ESCRITURAS al panel IClass. Activar con cuidado.
 *
 * Permisos: `admin.flags` (mismo que IClassFlagBody).
 */
export function IClassOsActionsBody() {
  const closeFlag = useFeatureFlag(CLOSE_FLAG);
  const assignFlag = useFeatureFlag(ASSIGN_FLAG);
  const setFlag = useSetFeatureFlag();
  const { can } = useMyPermissions();
  const canManage = can('admin.flags');

  const closeEnabled = closeFlag.data?.enabled ?? false;
  const assignEnabled = assignFlag.data?.enabled ?? false;
  const isPending = setFlag.isPending;

  function handleClose() {
    setFlag.mutate({ key: CLOSE_FLAG, enabled: !closeEnabled });
  }

  function handleAssign() {
    setFlag.mutate({ key: ASSIGN_FLAG, enabled: !assignEnabled });
  }

  return (
    <div className={styles.section}>
      <div className={`${styles.banner} ${styles.bannerInfo}`}>
        <span>
          <span className={styles.bannerTitle}>Atención.</span>{' '}
          Estos flags habilitan <strong>escrituras a IClass</strong> desde Prominense. Activá solo cuando el entorno esté listo.
        </span>
      </div>

      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Cierre de OS</h2>
          <span className={`${styles.statusBadge} ${closeEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {closeEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {closeEnabled
            ? 'Al cerrar una tarea en Prominense, se cerrará automáticamente la OS correspondiente en IClass.'
            : 'Cerrar una tarea en Prominense no afecta IClass. La OS debe cerrarse manualmente en el panel IClass.'}
        </p>

        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>
            {closeEnabled ? 'Desactivar cierre automático' : 'Activar cierre automático'}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={closeEnabled}
              disabled={isPending || closeFlag.isLoading || !canManage}
              onChange={handleClose}
              aria-label="Cierre de OS"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Asignación de cuadrilla</h2>
          <span className={`${styles.statusBadge} ${assignEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {assignEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {assignEnabled
            ? 'Al reasignar un técnico a una tarea, se asignará automáticamente su cuadrilla IClass a la OS correspondiente.'
            : 'Reasignar técnicos en Prominense no afecta IClass. La cuadrilla debe asignarse manualmente en el panel IClass.'}
        </p>

        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>
            {assignEnabled ? 'Desactivar asignación automática' : 'Activar asignación automática'}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={assignEnabled}
              disabled={isPending || assignFlag.isLoading || !canManage}
              onChange={handleAssign}
              aria-label="Asignación de cuadrilla"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo cambiar el flag.</span> Reintentá en unos segundos.</span>
        </div>
      )}
    </div>
  );
}
