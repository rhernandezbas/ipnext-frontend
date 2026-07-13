import { formatFileSize } from './formatFileSize';
import type { DraftAttachment } from '@/types/whatsapp';

/**
 * validateAttachment (messaging-inbox-v2-media F1.5 fase A, Tanda 2, design
 * §6.2) — ESPEJO fiel de la clasificación/límites del BE
 * (`spec-send.md` SEND-1 scenario 3/4, `DownloadChatMessageAttachment.ts`).
 *
 * Contrato de verdad = BE: esto es feedback inmediato para el agente (no
 * dejarlo subir 100MB para que rebote 415/413), pero el BE SIEMPRE
 * re-valida — si diverge, gana el BE.
 */
export const MAX_FILES = 10;

export const MAX_BYTES_BY_FILE_TYPE = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
} as const;

export type FileTypeKind = keyof typeof MAX_BYTES_BY_FILE_TYPE;

export function deriveFileType(mimeType: string): FileTypeKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

/**
 * Allowlist WhatsApp (bug MEDIO #8, post-review-adversarial) — ESPEJO de la
 * misma lista que `ComposerAttachButton` usa para el atributo `accept` del
 * picker (single source of truth, `ComposerAttachButton` la importa de acá
 * para no divergir). Antes de este fix, `validateFile` solo chequeaba
 * TOO_LARGE — un `.exe`/`.heic` pasaba la validación client-side entera y
 * recién rebotaba en el BE (415), sin feedback inmediato ni chip de error en
 * el tray.
 */
export const SUPPORTED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/3gpp',
  'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/amr',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'application/zip',
] as const;

export function validateFile(file: File): DraftAttachment['error'] {
  if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      code: 'UNSUPPORTED_TYPE',
      message: `Ese tipo de archivo${file.type ? ` (${file.type})` : ''} no se puede enviar por WhatsApp.`,
    };
  }

  const type = deriveFileType(file.type);
  if (file.size > MAX_BYTES_BY_FILE_TYPE[type]) {
    return {
      code: 'TOO_LARGE',
      message: `Supera el límite de ${formatFileSize(MAX_BYTES_BY_FILE_TYPE[type])} para ${type}.`,
    };
  }
  return null;
}
