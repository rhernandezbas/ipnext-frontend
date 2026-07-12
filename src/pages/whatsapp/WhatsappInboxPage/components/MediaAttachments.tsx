import { MediaAttachment } from './MediaAttachment';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';
import styles from './MediaAttachments.module.css';

interface MediaAttachmentsProps {
  attachments: WhatsappChatMessageAttachment[];
  /** Fix bug CRÍTICO #1 — threadeado hasta `MediaAttachment`/`MediaError`. */
  onRetryAttachment?: () => void;
}

/**
 * MediaAttachments — layout de grupo cuando un mensaje trae varios adjuntos
 * (design §6.3). 1 adjunto o mixto → stack vertical; ≥2 imágenes → grid
 * 2-col estilo álbum. Contenedor de presentación (no fetch) — no rompe el
 * patrón container-presentational.
 *
 * Stagger (§7.2): cada ítem recibe `--i` (índice 0-based) vía inline style,
 * consumido por el `transition-delay: calc(var(--i, 0) * 40ms)` del blur-up
 * de `MediaImage` (`Media.module.css`) — así los adjuntos que llegan juntos
 * no materializan todos a la vez.
 */
export function MediaAttachments({ attachments, onRetryAttachment }: MediaAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  const allImages = attachments.every((att) => att.fileType === 'image');
  const useGrid = attachments.length >= 2 && allImages;

  return (
    <div className={useGrid ? styles.grid : styles.stack} data-testid="message-attachments">
      {attachments.map((att, i) => (
        <div
          key={att.id}
          className={useGrid ? styles.gridTile : styles.stackItem}
          style={{ '--i': i } as React.CSSProperties}
        >
          <MediaAttachment attachment={att} onRetryAttachment={onRetryAttachment} />
        </div>
      ))}
    </div>
  );
}
