import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'contract-network-auto-assign';

/**
 * Card del flag `contract-network-auto-assign` para NetworkingSettingsPage → sección "Auto-
 * asignación nodo/AP" (contract-node-ap-auto-assign, Fase B FE). Sin esta card el flag es
 * INVISIBLE y el rollout (design §13: "prender el flag → leer SyncState") es imposible desde la
 * UI.
 *
 * Prender activa una escritura AUTO DURA post-sync UISP (design §5/§6): cada corrida deriva el
 * nodo/AP de cada contrato por MAC (cascada callerId → RadiusEvent → station UISP → AccessPoint,
 * design §4) y, cuando resuelve, PISA lo que haya — incluso una asignación manual (matriz fila 2).
 * Si NO resuelve, no toca nada (nunca nullea). El ON pide confirmación (useConfirm, tone danger),
 * igual que PppoeAutoMoveCard: es la misma familia de "automatización que actúa sobre datos
 * reales sin pedir permiso por evento". El OFF es directo — el tick siguiente ya no auto-asigna.
 *
 * Flag gate: admin.flags (mismo criterio que las cards vecinas de esta página).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA una "Inactiva" con
 * confianza (mismo criterio que PppoeAutoMoveCard: este flag también es un kill-switch de una
 * automatización que escribe sobre contratos reales).
 */
export function ContractNetworkAutoAssignCard() {
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
            <h2 className={styles.statusTitle}>Auto-asignación de nodo/Access Point</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer el estado de la auto-asignación.
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
        title: 'Activar auto-asignación de nodo/AP',
        message:
          'Este toggle enciende una automatización que actúa sobre contratos reales: en cada ' +
          'sincronización UISP, deriva el nodo y el access point de cada contrato por la MAC del ' +
          'equipo del cliente y, cuando resuelve, PISA lo que haya asignado — incluso una ' +
          'asignación manual. ¿Activarla ahora?',
        confirmLabel: 'Activar auto-asignación',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    // Apagar es inocuo (el tick siguiente ya no auto-asigna) → directo.
    setFlag.mutate({ key: FLAG_KEY, enabled: false });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Auto-asignación de nodo/Access Point</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          En cada sincronización UISP, auto-asigna el nodo y el access point de cada contrato
          derivando la MAC del equipo del cliente (callerId → eventos RADIUS → station UISP → AP
          del catálogo). Cuando resuelve, <strong>pisa</strong> la asignación existente — incluso
          una manual. Si no resuelve (equipo fuera de UISP, fibra, MAC sin match), no toca nada.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar auto-asignación' : 'Activar auto-asignación'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar auto-asignación' : 'Activar auto-asignación'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado de la auto-asignación.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
