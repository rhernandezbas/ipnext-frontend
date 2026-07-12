import { MediaPlaceholder } from './MediaPlaceholder';
import { MediaError } from './MediaError';
import { MediaImage } from './MediaImage';
import { MediaVideo } from './MediaVideo';
import { MediaAudio } from './MediaAudio';
import { MediaFile } from './MediaFile';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

interface MediaAttachmentProps {
  attachment: WhatsappChatMessageAttachment;
  /**
   * Fix bug CRÍTICO #1 (post-review-adversarial, 2 reviewers): sin este prop,
   * `MediaError` recibía `onRetry` `undefined` y el botón "Reintentar" no
   * hacía NADA. Threadeado desde `WhatsappInboxPage` (único lugar con
   * `queryClient`+`conversationId`) por `MessageThread`→`MessageBubble`→
   * `MediaAttachments`. Invalida la query del thread (refetch real).
   */
  onRetryAttachment?: () => void;
}

/**
 * MediaAttachment — router de un adjunto (design §2). Decide por `status`
 * PRIMERO (pending/failed son transversales a todos los `fileType`) y por
 * `fileType` DESPUÉS, solo cuando ya está `downloaded`. Cada hoja de tipo
 * asume `status==='downloaded'` y no repite el manejo de estados.
 *
 * Fix bug LOW #6 (post-review-adversarial): el switch original solo excluía
 * pending/failed, pero no confirmaba `status==='downloaded'` antes de armar
 * la hoja real — un status inesperado (ni pending/failed/downloaded) caía en
 * el switch igual. Guard explícito: cualquier status que no sea
 * 'downloaded' cae a `MediaPlaceholder` (nunca renderiza media sin confirmar).
 */
export function MediaAttachment({ attachment, onRetryAttachment }: MediaAttachmentProps) {
  if (attachment.status === 'pending') {
    return <MediaPlaceholder fileType={attachment.fileType} width={attachment.width} height={attachment.height} />;
  }

  if (attachment.status === 'failed') {
    return <MediaError filename={attachment.filename} onRetry={onRetryAttachment} />;
  }

  if (attachment.status !== 'downloaded') {
    return <MediaPlaceholder fileType={attachment.fileType} width={attachment.width} height={attachment.height} />;
  }

  switch (attachment.fileType) {
    case 'image':
      return <MediaImage attachment={attachment} />;
    case 'video':
      return <MediaVideo attachment={attachment} />;
    case 'audio':
      return <MediaAudio attachment={attachment} />;
    case 'file':
      return <MediaFile attachment={attachment} />;
    default:
      return null;
  }
}
