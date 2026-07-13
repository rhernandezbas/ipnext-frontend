import { Can } from '@/components/auth/Can';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'chat-media-download';

/**
 * Card del flag `chat-media-download` para WhatsappSettingsPage.
 * Controla la descarga automática (y el reintento periódico, cada ~2 minutos)
 * de las fotos, videos, audios y archivos que llegan por WhatsApp — se
 * guardan en MinIO para poder visualizarlos dentro del inbox
 * (messaging-inbox-v2-media, F1.5 fase A). Hoy el flag solo se prende por
 * API — esta card lo expone en Ajustes con un toggle.
 *
 * Flag gate: admin.flags (mismo permiso que las cards vecinas — toggle oculto
 * sin el permiso). Clona el patrón de RadiusAuthIngestCard (misma estructura,
 * mismo CSS module, mismos hooks).
 */
export function ChatMediaDownloadCard() {
  const { data: flagData, isLoading: flagLoading, isError: flagError } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  if (flagLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  const enabled = flagData?.enabled ?? false;

  function handleFlagToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Descarga de media de WhatsApp</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activa' : 'Inactiva'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Cuando está activa, las fotos, videos, audios y archivos que lleguen por WhatsApp se
          descargan automáticamente a MinIO (con reintento cada ~2 minutos ante fallas) para poder
          verse dentro del inbox. Con la descarga desactivada, los mensajes de solo-media llegan
          igual pero el adjunto no se guarda.
        </p>

        {/* ── Flag toggle (admin.flags gate) ─────────────────────────── */}
        {!flagError && (
          <Can permission="admin.flags">
            <div className={styles.statusActionRow}>
              <span className={styles.statusActionLabel}>
                {enabled ? 'Desactivar descarga de media' : 'Activar descarga de media'}
              </span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={setFlag.isPending}
                  onChange={handleFlagToggle}
                  aria-label="Descarga de media de WhatsApp automática"
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </label>
            </div>
          </Can>
        )}
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado de la descarga.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
