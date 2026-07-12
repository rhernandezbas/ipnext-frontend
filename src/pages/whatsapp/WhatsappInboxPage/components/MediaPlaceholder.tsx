import { Skeleton } from './Skeleton';
import { IconDownload } from './mediaIcons';
import styles from './Media.module.css';

interface MediaPlaceholderProps {
  fileType: 'image' | 'audio' | 'video' | 'file';
  width?: number | null;
  height?: number | null;
}

const FALLBACK_AR: Record<'image' | 'video', string> = {
  image: '4 / 3',
  video: '16 / 9',
};

const FIXED_MIN_HEIGHT: Record<'audio' | 'file', number> = {
  audio: 54,
  file: 72,
};

/**
 * MediaPlaceholder — "Descargando…" type-aware (design §3.5). Ocupa
 * EXACTAMENTE la misma caja que ocupará la media real: `aspect-ratio` de
 * `width`/`height` para image/video (mismo criterio que `MediaImage`/
 * `MediaVideo`, §6.1), alto fijo conocido para audio/file (§6.2) — el
 * reemplazo `pending → downloaded` es cero layout shift porque la caja no
 * cambia de tamaño.
 */
export function MediaPlaceholder({ fileType, width, height }: MediaPlaceholderProps) {
  const isBoxType = fileType === 'image' || fileType === 'video';

  const boxStyle = isBoxType
    ? ({ '--media-ar': width && height ? `${width} / ${height}` : FALLBACK_AR[fileType as 'image' | 'video'] } as React.CSSProperties)
    : { minHeight: FIXED_MIN_HEIGHT[fileType as 'audio' | 'file'] };

  return (
    <div
      className={isBoxType ? styles.placeholderBox : styles.placeholderBar}
      style={boxStyle}
      role="status"
      aria-live="polite"
    >
      <Skeleton width="100%" height="100%" className={styles.placeholderSkeleton} />
      <span className={styles.placeholderContent}>
        <IconDownload className={styles.placeholderSpinner} />
        Descargando adjunto…
      </span>
    </div>
  );
}
