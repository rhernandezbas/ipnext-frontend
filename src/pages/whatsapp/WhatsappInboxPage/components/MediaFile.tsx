import { formatFileSize } from '@/utils/formatFileSize';
import { FileTypeIcon, IconDownload } from './mediaIcons';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';
import styles from './Media.module.css';

interface MediaFileProps {
  attachment: WhatsappChatMessageAttachment;
}

/** Extensión en mayúsculas — preferí el filename real; fallback al `contentType`. */
function deriveExtension(filename: string | null, contentType: string): string {
  if (filename) {
    const dot = filename.lastIndexOf('.');
    if (dot > -1 && dot < filename.length - 1) return filename.slice(dot + 1).toUpperCase();
  }
  const subtype = contentType.split('/')[1] ?? contentType;
  const last = subtype.split('.').pop() ?? subtype;
  return last.replace(/^x-/, '').toUpperCase();
}

/**
 * MediaFile — hoja `fileType==='file'` ya `downloaded` (design §3.4). Card
 * "documento" (patrón WhatsApp): ícono por `contentType` + filename (2
 * líneas máx, CSS `line-clamp`) + botón descarga. Ícono/filename/meta nunca
 * emoji — SVG inline (`mediaIcons`). Descarga: `<a href download>` — el BE
 * ya manda `Content-Disposition`, el browser hace el resto.
 */
export function MediaFile({ attachment }: MediaFileProps) {
  const displayName = attachment.filename ?? 'Archivo adjunto';
  const extension = deriveExtension(attachment.filename, attachment.contentType);
  const sizeText = formatFileSize(attachment.fileSize);
  const meta = [extension, sizeText].filter((part): part is string => Boolean(part)).join(' · ');

  return (
    <div className={styles.mediaFile}>
      <span className={styles.mediaFileIcon}>
        <FileTypeIcon contentType={attachment.contentType} />
      </span>
      <div className={styles.mediaFileInfo}>
        <p className={styles.mediaFileName}>{displayName}</p>
        <p className={styles.mediaFileMeta}>{meta}</p>
      </div>
      <a
        href={attachment.url}
        download
        className={styles.mediaFileDownload}
        aria-label={`Descargar ${displayName}`}
      >
        <IconDownload />
      </a>
    </div>
  );
}
