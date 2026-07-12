import { useState } from 'react';
import { IconAlert } from './mediaIcons';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';
import styles from './Media.module.css';

interface MediaVideoProps {
  attachment: WhatsappChatMessageAttachment;
}

/**
 * MediaVideo — hoja `fileType==='video'` ya `downloaded` (design §3.2).
 * `<video controls preload="metadata">` nativo: accesibilidad de teclado
 * gratis, no se reinventa el player. Sin poster (no hay ffmpeg en fase A) ni
 * animación custom — un player se ve/opera seguido, sin motion decorativo.
 *
 * Fix bug MEDIUM #5 (post-review-adversarial): el DTO puede decir
 * `downloaded` mientras el binario todavía no está servible (mismo 409-race
 * que documenta `MediaImage`) — sin `onError`, el `<video>` nativo quedaba
 * roto sin ningún mensaje. Mismo criterio que `MediaImage`: estado roto
 * local con fallback visible, reservando la misma caja (aspect-ratio).
 */
export function MediaVideo({ attachment }: MediaVideoProps) {
  const [broken, setBroken] = useState(false);
  const ar = attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : '16 / 9';

  if (broken) {
    return (
      <div className={styles.mediaVideoBroken} style={{ '--media-ar': ar } as React.CSSProperties} role="alert">
        <IconAlert />
        No se pudo cargar el video
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- Chatwoot no reporta subtítulos; fuera de alcance de esta tanda.
    <video
      className={styles.mediaVideo}
      style={{ '--media-ar': ar } as React.CSSProperties}
      src={attachment.url}
      controls
      preload="metadata"
      onError={() => setBroken(true)}
    />
  );
}
