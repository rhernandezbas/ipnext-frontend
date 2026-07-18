/**
 * validateNewsAttachment (N2-FE) — client-side pre-flight of the news-attachment
 * upload rules. Immediate feedback for the operator (don't let them wait for a
 * 20 MB upload to bounce). The BE ALWAYS re-validates — if this diverges, the BE
 * wins (415 UNSUPPORTED_NEWS_ATTACHMENT_TYPE / 413 FILE_TOO_LARGE / 422 TOO_MANY).
 *
 * Mirrors AttachFilesToNews (BE): `.md` is accepted by EXTENSION first (browsers
 * report an inconsistent MIME for it — text/plain, application/octet-stream, or
 * empty), the rest by declared MIME.
 */
import { formatFileSize } from './formatFileSize';

/** 10 MiB per file (BE MAX_FILE_BYTES). */
export const NEWS_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** 20 attachments per post (BE MAX_FILES / TOO_MANY_NEWS_ATTACHMENTS). */
export const NEWS_ATTACHMENT_MAX_COUNT = 20;

/** MIME types accepted by declared MIME (`.md` is handled separately, by extension). */
export const NEWS_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/markdown',
] as const;

/** `accept` attribute for the file picker — the MIME allowlist plus the `.md` extension. */
export const NEWS_ATTACHMENT_ACCEPT = [...NEWS_ATTACHMENT_MIME_TYPES, '.md'].join(',');

export interface NewsAttachmentValidationError {
  code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'TOO_MANY';
  message: string;
}

function isMarkdown(file: File): boolean {
  return /\.md$/i.test(file.name);
}

function isSupportedType(file: File): boolean {
  if (isMarkdown(file)) return true;
  return (NEWS_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type);
}

/**
 * Validate a batch of files against the current attachment count. Returns the
 * FIRST blocking error, or `null` when every file passes. Order of checks
 * mirrors the surfaces the BE guards: count → type → size.
 */
export function validateNewsFiles(
  files: File[],
  existingCount: number,
): NewsAttachmentValidationError | null {
  if (existingCount + files.length > NEWS_ATTACHMENT_MAX_COUNT) {
    return {
      code: 'TOO_MANY',
      message: `Máximo ${NEWS_ATTACHMENT_MAX_COUNT} adjuntos por noticia. Quitá algunos e intentá de nuevo.`,
    };
  }
  for (const file of files) {
    if (!isSupportedType(file)) {
      return {
        code: 'UNSUPPORTED_TYPE',
        message: `Formato no soportado${file.name ? ` (${file.name})` : ''}. Solo imágenes (jpg, png, webp, gif), PDF o .md.`,
      };
    }
    if (file.size > NEWS_ATTACHMENT_MAX_BYTES) {
      return {
        code: 'TOO_LARGE',
        message: `"${file.name}" supera el límite de ${formatFileSize(NEWS_ATTACHMENT_MAX_BYTES)} por archivo.`,
      };
    }
  }
  return null;
}
