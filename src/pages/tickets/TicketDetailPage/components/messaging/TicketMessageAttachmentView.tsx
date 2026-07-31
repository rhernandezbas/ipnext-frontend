import { useState } from 'react';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { IconFile } from '../messagingIcons';
import styles from './TicketMessageAttachmentView.module.css';

export interface ViewableAttachment {
  id: string;
  url: string | null;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  kind?: 'image' | 'audio' | 'video' | null;
}

interface Props {
  attachment: ViewableAttachment;
}

/** Fix #6 (heredado de TicketCommentsTimeline) — solo http(s) es un href seguro. */
function isSafeHref(url: string): boolean {
  try {
    const scheme = new URL(url, window.location.origin).protocol;
    return scheme === 'http:' || scheme === 'https:';
  } catch {
    return false;
  }
}

function isLegacyDataImage(url: string | null): boolean {
  return !!url && url.trim().startsWith('data:image/');
}

type EffectiveKind = 'image' | 'audio' | 'video' | 'unknown';

function deriveKind(att: ViewableAttachment): EffectiveKind {
  if (att.kind === 'image' || att.kind === 'audio' || att.kind === 'video') return att.kind;
  if (isLegacyDataImage(att.url)) return 'image';
  if (att.mimeType?.startsWith('image/')) return 'image';
  return 'unknown';
}

/**
 * TicketMessageAttachmentView — ticket-messaging-ui. Render POR TIPO de un
 * adjunto YA PERSISTIDO del hilo (nota interna legacy de imagen data-URI, o
 * mensaje nuevo image/audio/video servido por el BE-proxy
 * `/api/tickets/messages/attachments/:id/file`). Un componente único para las
 * 3 categorías + el fallback de link/texto — evita triplicar la lógica de
 * "¿es seguro linkearlo?" en cada lane del hilo.
 */
export function TicketMessageAttachmentView({ attachment }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  if (attachment.url === null) {
    return (
      <span className={styles.unavailable} title={attachment.filename}>
        <IconFile className={styles.fileIcon} />
        {attachment.filename} — no disponible
      </span>
    );
  }

  const kind = deriveKind(attachment);
  const url = attachment.url;

  if (kind === 'image' && !broken) {
    return (
      <>
        <button
          type="button"
          className={styles.imageThumb}
          onClick={() => setLightboxOpen(true)}
          aria-label={`Ver ${attachment.filename} en grande`}
        >
          <img src={url} alt={attachment.filename} onError={() => setBroken(true)} referrerPolicy="no-referrer" />
        </button>
        {lightboxOpen && (
          <ImageLightbox url={url} alt={attachment.filename} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }

  if (kind === 'audio') {
    return (
      <figure className={styles.mediaFigure}>
        <audio
          data-testid="ticket-attachment-audio"
          className={styles.audioPlayer}
          controls
          src={url}
          onError={() => setBroken(true)}
        >
          Tu navegador no puede reproducir este audio.
        </audio>
        <figcaption className={styles.mediaCaption}>{attachment.filename}</figcaption>
      </figure>
    );
  }

  if (kind === 'video') {
    return (
      <figure className={styles.mediaFigure}>
        <video
          data-testid="ticket-attachment-video"
          className={styles.videoPlayer}
          controls
          src={url}
          onError={() => setBroken(true)}
        >
          Tu navegador no puede reproducir este video.
        </video>
        <figcaption className={styles.mediaCaption}>{attachment.filename}</figcaption>
      </figure>
    );
  }

  // Fallback: kind desconocido (o una imagen/audio/video roto) — mismo
  // criterio de allowlist de esquema que antes (Fix #6).
  if (!isSafeHref(url)) {
    return (
      <span className={styles.fileLink} title={attachment.filename}>
        <IconFile className={styles.fileIcon} />
        {attachment.filename}
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.fileLink} title={attachment.filename}>
      <IconFile className={styles.fileIcon} />
      {attachment.filename}
    </a>
  );
}
