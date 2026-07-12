import { useState } from 'react';
import { formatFileSize } from '@/utils/formatFileSize';
import { IconAlert } from './mediaIcons';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';
import styles from './Media.module.css';

interface MediaAudioProps {
  attachment: WhatsappChatMessageAttachment;
}

/**
 * MediaAudio — hoja `fileType==='audio'` ya `downloaded` (design §3.3).
 * `<audio controls preload="metadata">` nativo. Alto fijo conocido
 * (`min-height: 54px`, §6.2) — el control nativo mide ~40-54px, así el
 * placeholder reserva exactamente esa caja (cero shift). Meta opcional:
 * filename + tamaño (`formatFileSize`), nunca "null".
 *
 * Fix bug MEDIUM #5 (post-review-adversarial): mismo 409-race que
 * `MediaImage`/`MediaVideo` — el DTO puede decir `downloaded` mientras el
 * binario todavía no está servible. Sin `onError`, el `<audio>` nativo
 * quedaba roto sin ningún mensaje.
 */
export function MediaAudio({ attachment }: MediaAudioProps) {
  const [broken, setBroken] = useState(false);
  const sizeText = formatFileSize(attachment.fileSize);
  const metaParts = [attachment.filename, sizeText].filter((part): part is string => Boolean(part));

  if (broken) {
    return (
      <div className={styles.mediaAudioBroken} role="alert">
        <IconAlert />
        No se pudo cargar el audio
      </div>
    );
  }

  return (
    <div className={styles.mediaAudioWrapper}>
      <audio src={attachment.url} controls preload="metadata" onError={() => setBroken(true)} />
      {metaParts.length > 0 && (
        <span data-testid="media-audio-meta" className={styles.mediaAudioMeta}>
          {metaParts.join(' · ')}
        </span>
      )}
    </div>
  );
}
