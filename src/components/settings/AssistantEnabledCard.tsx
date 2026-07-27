import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'ai-assistant-enabled';

/**
 * Card del flag `ai-assistant-enabled` (change `ai-assistant-multiagent`) — el kill-switch
 * RAÍZ del asistente. Hasta ahora sólo se podía tocar desde la base: sin esta card el bot era
 * imposible de prender (o de apagar) desde la UI.
 *
 * Calca el patrón de sus hermanas (UispSyncCard/RadiusAutoCureCard): mismo CSS module por
 * composición, mismos hooks, gate `admin.flags`.
 *
 * **Divergencia deliberada: el ON pregunta, el OFF no.** Sus hermanas confirman en las dos
 * direcciones, pero acá la asimetría es real: prender significa que una IA empieza a
 * escribirle a clientes reales por WhatsApp, y eso merece una pausa. Apagar es el freno de
 * mano — y un freno de mano que pregunta "¿estás seguro?" es un peor freno de mano. Si el bot
 * está diciendo algo que no corresponde, el operador tiene que poder cortarlo de un click.
 *
 * Error de lectura → "Estado desconocido" + reintentar, NUNCA un "Inactivo" con confianza:
 * afirmar que está apagado cuando no se sabe te haría creer que el bot está callado mientras
 * quizás le está respondiendo a alguien.
 */
export function AssistantEnabledCard() {
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
            <h2 className={styles.statusTitle}>Asistente IA</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>
                No se pudo leer si el asistente está activo.
              </span>{' '}
              Reintentá — no asumas que está apagado.
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
    // Apagar: inmediato. Es el freno de mano.
    if (enabled) {
      setFlag.mutate({ key: FLAG_KEY, enabled: false });
      return;
    }

    const ok = await confirm({
      title: 'Activar el asistente IA',
      message:
        'A partir de ahora el asistente va a responderle DIRECTAMENTE a los clientes por ' +
        'WhatsApp, sin que un humano revise cada mensaje. Sólo va a actuar en las áreas con ' +
        'agente habilitado y sobre los temas que le cargaste. ¿Activarlo ahora?',
      confirmLabel: 'Activar asistente',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setFlag.mutate({ key: FLAG_KEY, enabled: true });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Asistente IA</h2>
          <span
            className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}
          >
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Kill-switch raíz. Apagado, el asistente <strong>no responde nada</strong> por más que
          haya agentes habilitados y credenciales cargadas. Prendido, contesta según el ruteo y
          los temas configurados más abajo. Apagarlo <strong>no borra</strong> ninguna
          configuración.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar asistente' : 'Activar asistente'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar asistente IA' : 'Activar asistente IA'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>
              No se pudo cambiar el estado del asistente.
            </span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
