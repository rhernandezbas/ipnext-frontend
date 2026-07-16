import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'radius-auto-cure';

/**
 * Card del flag `radius-auto-cure` para NetworkingSettingsPage → sección "RADIUS" (patrón EXACTO
 * de ContractNetworkAutoAssignCard: mismo CSS module por composición, mismos hooks). Hoy el flag
 * solo se puede prender desde la DB — sin esta card es INVISIBLE para el usuario.
 *
 * Prender activa un watcher que corre cada 5 minutos: revisa las sesiones PPPoE activas y, cuando
 * encuentra una colgada (más de 5 minutos sin actividad), la cura automáticamente. Cada cura queda
 * registrada en un log auditable (Networking → Auditoría / Logs → pestaña "Sesiones curadas").
 *
 * A diferencia de ContractNetworkAutoAssignCard (donde el OFF es directo, sin fricción), acá TANTO
 * el ON como el OFF piden confirmación (useConfirm, tone danger): prender empieza a curar sesiones
 * automáticamente sin pedir permiso por evento; apagar deja las sesiones colgadas sin curar hasta
 * que se resuelvan a mano. Ambos son cambios de comportamiento con impacto real sobre sesiones de
 * clientes — ninguno es inocuo.
 *
 * Flag gate: admin.flags (mismo criterio que las cards vecinas de esta página).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA una "Inactivo" con confianza
 * (mismo criterio que ContractNetworkAutoAssignCard: este flag también es un kill-switch de una
 * automatización que actúa sobre sesiones reales).
 */
export function RadiusAutoCureCard() {
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
            <h2 className={styles.statusTitle}>Auto-cure de sesiones RADIUS</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer el estado del auto-cure.
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
        title: 'Activar auto-cure de sesiones RADIUS',
        message:
          'Este toggle enciende un watcher que corre cada 5 minutos: detecta sesiones PPPoE ' +
          'colgadas (más de 5 minutos sin actividad) y las cura automáticamente, dejando un log ' +
          'auditable en Networking → Auditoría / Logs → pestaña "Sesiones curadas". ¿Activarlo ' +
          'ahora?',
        confirmLabel: 'Activar auto-cure',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar auto-cure de sesiones RADIUS',
      message:
        'Al apagarlo, el watcher deja de curar sesiones PPPoE colgadas automáticamente. Las ' +
        'sesiones colgadas van a quedar así hasta que se curen a mano. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar auto-cure',
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
          <h2 className={styles.statusTitle}>Auto-cure de sesiones RADIUS</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          El watcher revisa las sesiones PPPoE activas y, cuando encuentra una <strong>colgada</strong>{' '}
          (más de 5 min sin actividad), la cura automáticamente. Cada cura queda registrada en un
          log auditable, visible en Networking → Auditoría / Logs → pestaña{' '}
          <strong>&quot;Sesiones curadas&quot;</strong>.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar auto-cure' : 'Activar auto-cure'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar auto-cure' : 'Activar auto-cure'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del auto-cure.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
