/**
 * Maps the BE attachment-upload error codes to a human Spanish message.
 * Shared by the gallery (TaskPhotosGallery) and the create-task modal so both
 * surfaces report the SAME, specific reason (e.g. the 503 STORAGE_NOT_CONFIGURED)
 * instead of a generic "no se pudo subir".
 */
const DEFAULT_MAX_PHOTOS = 15;

export function mapUploadError(err: unknown, maxPhotos: number = DEFAULT_MAX_PHOTOS): string {
  const data = (err as { response?: { status?: number; data?: { error?: string; code?: string; message?: string } } })?.response;
  const code = data?.data?.code ?? data?.data?.error;
  switch (code) {
    case 'UNSUPPORTED_ATTACHMENT_TYPE': return 'Formato no soportado. Solo jpg, png o webp.';
    case 'IMAGE_TOO_LARGE':
    case 'FILE_TOO_LARGE': return 'Alguna foto supera el límite de 10 MB.';
    case 'TOO_MANY_ATTACHMENTS':
    case 'TOO_MANY_FILES': return `Máximo ${maxPhotos} fotos por tarea.`;
    case 'NO_FILES': return 'No se seleccionó ninguna foto.';
    case 'STORAGE_NOT_CONFIGURED': return 'El almacenamiento de fotos no está disponible por ahora.';
    case 'TASK_NOT_FOUND': return 'La tarea ya no existe.';
    default: return 'No se pudieron subir las fotos. Intentá de nuevo.';
  }
}
