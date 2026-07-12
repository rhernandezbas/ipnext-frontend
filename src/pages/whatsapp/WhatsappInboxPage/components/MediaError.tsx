import { IconAlert } from './mediaIcons';
import styles from './Media.module.css';

interface MediaErrorProps {
  filename?: string | null;
  onRetry?: () => void;
}

/**
 * MediaError — status `failed` (design §3.6). Misma caja reservada que el
 * resto de los estados. Reintentar: semántica honesta — la descarga real la
 * reintenta el scheduler del BE; este botón solo fuerza un re-check
 * (decisión del consumidor vía `onRetry`), nunca re-dispara la descarga.
 */
export function MediaError({ filename, onRetry }: MediaErrorProps) {
  const retryLabel = filename ? `Reintentar cargar ${filename}` : 'Reintentar';

  return (
    <div className={styles.errorCard} role="alert">
      <div className={styles.errorHeader}>
        <IconAlert />
        <p className={styles.errorText}>No se pudo cargar el adjunto</p>
      </div>
      {filename && <p className={styles.errorFilename}>{filename}</p>}
      <button
        type="button"
        className={styles.errorRetryBtn}
        onClick={onRetry}
        aria-label={retryLabel}
      >
        Reintentar
      </button>
    </div>
  );
}
