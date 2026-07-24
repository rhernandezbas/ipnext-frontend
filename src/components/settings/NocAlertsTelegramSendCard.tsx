import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'noc-alerts-telegram-send';

/**
 * Card del flag `noc-alerts-telegram-send` (change `noc-alerts-config`, Fase F
 * FE) para AlertsConfigPage → sección "Feature flags" (mismo CSS module por
 * composición, mismos hooks que NocAlertsHubEnabledCard/RadiusAutoCureCard).
 *
 * Independiente de `noc-alerts-hub-enabled` (design.md "Flags de
 * convivencia"): el hub puede estar prendido (panel + persistencia + SSE) sin
 * mandar nada a Telegram — este flag es el que decide si, además, cada
 * alerta se reenvía al canal de Telegram del NOC. Seedeado OFF por defecto
 * (convivencia con el flujo legacy antes del cutover).
 *
 * TANTO el ON como el OFF piden confirmación (tone danger): prender empieza
 * a mandar mensajes REALES a Telegram por cada alerta nueva (ruido para el
 * equipo si el volumen es alto); apagar deja de notificar — el equipo puede
 * perderse una alerta crítica si no está mirando el panel. Ninguna dirección
 * es inocua.
 *
 * Flag gate: admin.flags.
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza — igual criterio que sus hermanas: no querés
 * mostrar "no manda a Telegram" cuando en realidad no sabés si manda o no.
 */
export function NocAlertsTelegramSendCard() {
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
            <h2 className={styles.statusTitle}>Envío de alertas a Telegram</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudo leer el estado del envío a Telegram.</span>{' '}
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
        title: 'Activar el envío de alertas a Telegram',
        message:
          'Este toggle empieza a mandar un mensaje REAL a Telegram por cada alerta nueva del hub ' +
          '(independiente de si el panel está prendido). Si el volumen de alertas es alto, va a ' +
          'generar ruido en el canal. ¿Activarlo ahora?',
        confirmLabel: 'Activar envío',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar el envío de alertas a Telegram',
      message:
        'Al apagarlo, el equipo deja de recibir alertas por Telegram — solo van a verse en el ' +
        'panel "Alertas NOC". Si nadie está mirando el panel, una alerta crítica puede pasar ' +
        'desapercibida hasta que alguien la revise a mano. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar envío',
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
          <h2 className={styles.statusTitle}>Envío de alertas a Telegram</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Independiente del hub: con esto <strong>prendido</strong>, cada alerta nueva se reenvía además
          al canal de Telegram del NOC. Con esto <strong>apagado</strong>, las alertas solo se ven en el
          panel — el hub y el panel siguen funcionando igual.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar envío a Telegram' : 'Activar envío a Telegram'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar envío de alertas a Telegram' : 'Activar envío de alertas a Telegram'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del envío a Telegram.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
