import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'fiber-auto-provision';

/**
 * Card del flag base `fiber-auto-provision` (K2-FE) para NetworkingSettingsPage
 * → sección "Fibra" (espejo EXACTO de FiberAutoProvisionCard / RadiusAutoCureCard:
 * mismo CSS module por composición, mismos hooks). Hoy el flag solo se puede
 * prender desde la DB — sin esta card es INVISIBLE para el usuario.
 *
 * OJO — NO confundir con FiberAutoProvisionCard (la card de al lado): esa gatea
 * el flag `fiber-auto-provision-watcher`, el WATCHER full-auto. ESTA gatea el
 * MOTOR / BOTÓN: prender habilita el botón "Aprovisionar ONU" en las tareas de
 * instalación de fibra, el wizard MANUAL (con dry-run previo) que configura la
 * ONU en SmartOLT a mano desde la tarea. Requiere que estén configurados los
 * envs SMARTOLT_BASE_URL / SMARTOLT_API_TOKEN en el servidor — si faltan, las
 * llamadas dan 503.
 *
 * Igual que sus hermanas, TANTO el ON como el OFF piden confirmación (useConfirm,
 * tone danger): prender habilita el aprovisionamiento de ONUs REALES vía el botón
 * (requiere envs SmartOLT); apagar saca el botón de las tareas y nadie puede
 * aprovisionar a mano desde la app. Ninguno es inocuo.
 *
 * Flag gate: admin.flags (mismo criterio que las cards vecinas de esta página).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza (mismo criterio que las hermanas: este flag también
 * gatea una operación que toca equipos reales vía SmartOLT).
 */
export function FiberProvisionEnabledCard() {
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
            <h2 className={styles.statusTitle}>Aprovisionamiento de ONUs (motor / botón)</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer el estado del aprovisionamiento.
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
        title: 'Activar el botón de aprovisionamiento de ONUs',
        message:
          'Este toggle habilita el botón "Aprovisionar ONU" en las tareas de fibra: el wizard ' +
          'manual (con dry-run previo) que configura ONUs REALES en SmartOLT a mano desde la ' +
          'tarea. Requiere los envs SMARTOLT_BASE_URL y SMARTOLT_API_TOKEN en el servidor; si ' +
          'faltan, las llamadas dan 503. ¿Activarlo ahora?',
        confirmLabel: 'Activar botón',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar el botón de aprovisionamiento de ONUs',
      message:
        'Al apagarlo, el botón "Aprovisionar ONU" desaparece de las tareas de fibra y nadie ' +
        'puede aprovisionar ONUs a mano desde la app. Los seriales ya cargados quedan ' +
        'guardados. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar botón',
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
          <h2 className={styles.statusTitle}>Aprovisionamiento de ONUs (motor / botón)</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Habilita el botón <strong>&quot;Aprovisionar ONU&quot;</strong> en las tareas de
          instalación de fibra: el wizard <strong>manual</strong> (con <strong>dry-run</strong>{' '}
          previo) que configura la ONU en SmartOLT a mano desde la tarea. Requiere los envs{' '}
          <strong>SMARTOLT_BASE_URL</strong> y <strong>SMARTOLT_API_TOKEN</strong> en el servidor;
          si faltan, las llamadas dan <strong>503</strong>. A diferencia del watcher (la card de al
          lado, full-auto), este es el aprovisionamiento disparado a mano desde la tarea.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar botón' : 'Activar botón'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar botón' : 'Activar botón'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del aprovisionamiento.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
