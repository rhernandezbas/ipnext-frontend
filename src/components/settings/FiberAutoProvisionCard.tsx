import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'fiber-auto-provision-watcher';

/**
 * Card del flag `fiber-auto-provision-watcher` (K3-FE, fiber-serial-fe) para
 * NetworkingSettingsPage → sección "Fibra" (espejo EXACTO de RadiusAutoCureCard:
 * mismo CSS module por composición, mismos hooks). Hoy el flag solo se puede
 * prender desde la DB — sin esta card es INVISIBLE para el usuario.
 *
 * Prender activa el watcher del BE que corre cada 5 minutos: toma las tareas
 * ABIERTAS con serial de ONU cargado y, cuando esa ONU aparece conectada en
 * SmartOLT, la aprovisiona sola (solo ONUs Huawei, máximo 3 intentos por tarea).
 * Cada intento deja una nota automática en la descripción de la tarea.
 *
 * Igual que RadiusAutoCureCard, TANTO el ON como el OFF piden confirmación
 * (useConfirm, tone danger): prender configura ONUs REALES solo, sin pedir
 * permiso por evento; apagar vuelve TODO el aprovisionamiento a manual (los
 * seriales cargados quedan, pero nadie los aprovisiona). Ninguno es inocuo.
 *
 * Flag gate: admin.flags (mismo criterio que las cards vecinas de esta página).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza (mismo criterio que RadiusAutoCureCard: este flag
 * también es el kill-switch de una automatización que toca equipos reales).
 */
export function FiberAutoProvisionCard() {
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
            <h2 className={styles.statusTitle}>Aprovisionamiento automático de ONUs (watcher)</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer el estado del watcher.
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
        title: 'Activar aprovisionamiento automático de ONUs',
        message:
          'Este toggle enciende un watcher que corre cada 5 minutos: toma las tareas abiertas ' +
          'con serial de ONU cargado y, cuando la ONU aparece en SmartOLT, configura ONUs ' +
          'REALES solo, sin pedir permiso por evento (solo Huawei, máximo 3 intentos por ' +
          'tarea, con notas automáticas en la descripción). ¿Activarlo ahora?',
        confirmLabel: 'Activar watcher',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar aprovisionamiento automático de ONUs',
      message:
        'Al apagarlo, ninguna ONU se aprovisiona sola: todo el aprovisionamiento vuelve a ser ' +
        'manual desde la tarea (botón "Aprovisionar ONU"). Los seriales ya cargados quedan ' +
        'guardados. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar watcher',
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
          <h2 className={styles.statusTitle}>Aprovisionamiento automático de ONUs (watcher)</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          El watcher corre <strong>cada 5 minutos</strong>: toma las <strong>tareas abiertas</strong>{' '}
          con serial de ONU cargado y, cuando esa ONU aparece conectada en SmartOLT, la aprovisiona
          sola — solo ONUs <strong>Huawei</strong>, máximo <strong>3 intentos</strong> por tarea.
          Cada intento deja una nota automática en la descripción de la tarea.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar watcher' : 'Activar watcher'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar watcher' : 'Activar watcher'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del watcher.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
