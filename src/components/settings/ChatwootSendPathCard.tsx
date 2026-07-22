import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'messaging-send-via-chatwoot';

/**
 * Card del flag `messaging-send-via-chatwoot` para WhatsappSettingsPage →
 * sección "Envío" (espejo EXACTO de RadiusAutoCureCard / FiberAutoProvisionCard:
 * mismo CSS module por composición, mismos hooks, mismo manejo de error de
 * fetch). Hoy el flag solo se puede prender desde la DB — sin esta card es
 * INVISIBLE para el usuario.
 *
 * Este flag es el eje central del send-path saliente (chatwoot-hub-sendpath):
 * con el flag ACTIVO, los templates que salen del hilo y los envíos masivos
 * pasan por la API de Chatwoot (Chatwoot registra el mensaje en la
 * conversación y lo despacha a Twilio) — el agente ve en el hilo lo que se
 * mandó. Con el flag INACTIVO, el envío sigue el camino directo por Twilio:
 * llega igual al cliente, pero no queda registrado en Chatwoot.
 *
 * Igual que RadiusAutoCureCard/FiberAutoProvisionCard, TANTO el ON como el OFF
 * piden confirmación (useConfirm, tone danger): prender cambia el camino de
 * TODO el saliente por template sin pedir permiso por evento; apagar vuelve
 * a un camino que ya viene funcionando pero pierde el registro en Chatwoot.
 * Ninguno es inocuo. Prender además depende de que el sync de templates de
 * Chatwoot esté activo — si no lo está, los envíos vía Chatwoot van a fallar.
 *
 * Flag gate: admin.flags (mismo criterio que las cards vecinas de esta página).
 *
 * Error de fetch del flag → "Estado desconocido" + reintentar, NUNCA un
 * "Inactivo" con confianza (mismo criterio que las cards hermanas: este flag
 * también es el kill-switch de una automatización que toca el envío real a
 * clientes).
 */
export function ChatwootSendPathCard() {
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
            <h2 className={styles.statusTitle}>Envío vía Chatwoot (eje central)</h2>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudo leer el estado del envío vía Chatwoot.</span>{' '}
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
        title: 'Activar envío vía Chatwoot',
        message:
          'Este toggle cambia el camino de TODO el saliente por template: los templates del hilo ' +
          'y los envíos masivos van a salir a través de Chatwoot (Chatwoot registra el mensaje en ' +
          'la conversación y lo despacha a Twilio), sin pedir permiso por evento. Requiere el sync ' +
          'de templates de Chatwoot activo — si no lo está, estos envíos van a fallar. ¿Activarlo ' +
          'ahora?',
        confirmLabel: 'Activar envío vía Chatwoot',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar envío vía Chatwoot',
      message:
        'Al apagarlo, los templates del hilo y los envíos masivos vuelven a salir directo por ' +
        'Twilio: el mensaje llega igual al cliente, pero NO va a quedar registrado en la ' +
        'conversación de Chatwoot. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar envío vía Chatwoot',
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
          <h2 className={styles.statusTitle}>Envío vía Chatwoot (eje central)</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          <strong>Prendido</strong>: los templates que salen del hilo y los envíos masivos pasan por
          Chatwoot — Chatwoot registra el mensaje en la conversación y lo despacha a Twilio, así el
          agente ve en el hilo lo que se mandó. <strong>Apagado</strong>: el envío sigue el camino
          directo por Twilio — llega igual al cliente, pero no queda registrado en Chatwoot.
        </p>

        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <span>
            <span className={styles.bannerTitle}>Dependencia:</span> requiere el sync de templates
            de Chatwoot activo.
          </span>
        </div>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar envío vía Chatwoot' : 'Activar envío vía Chatwoot'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={handleFlagToggle}
                aria-label={enabled ? 'Desactivar envío vía Chatwoot' : 'Activar envío vía Chatwoot'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isSuccess && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
          <span>
            <span className={styles.bannerTitle}>Listo.</span>{' '}
            {enabled ? 'Envío vía Chatwoot activado.' : 'Envío vía Chatwoot desactivado.'}
          </span>
        </div>
      )}

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del envío vía Chatwoot.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
