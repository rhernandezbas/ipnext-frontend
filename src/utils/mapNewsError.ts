/**
 * mapNewsError (N2-FE) — turns the BE's typed attachment-upload and
 * NOC-broadcast error responses into human Spanish messages, so every surface
 * (the modal attachments manager, the drawer broadcast button) reports the SAME
 * specific reason instead of a generic "no se pudo".
 */

interface ApiErrorLike {
  response?: { status?: number; data?: { code?: string; error?: string } };
}

function readError(err: unknown): { status?: number; code?: string } {
  const e = (err as ApiErrorLike)?.response;
  return { status: e?.status, code: e?.data?.code ?? e?.data?.error };
}

/**
 * Attachment upload / link errors. Codes are the BE wire contract
 * (newsMedia.routes + newsAttachment errors):
 *   FILE_TOO_LARGE (413), TOO_MANY_FILES (400), UPLOAD_ERROR (400),
 *   NO_ATTACHMENT (400), VALIDATION_ERROR (400, non-string link url),
 *   UNSUPPORTED_NEWS_ATTACHMENT_TYPE (415), TOO_MANY_NEWS_ATTACHMENTS (422),
 *   INVALID_LINK_ATTACHMENT (422), NEWS_POST_NOT_FOUND (404).
 */
export function mapNewsAttachmentError(err: unknown): string {
  const { code } = readError(err);
  switch (code) {
    case 'FILE_TOO_LARGE':
      return 'Alguno de los archivos supera el límite de 10 MB.';
    case 'TOO_MANY_FILES':
    case 'TOO_MANY_NEWS_ATTACHMENTS':
      return 'Máximo 20 adjuntos por noticia.';
    case 'UNSUPPORTED_NEWS_ATTACHMENT_TYPE':
      return 'Formato no soportado. Solo imágenes, PDF o .md.';
    case 'INVALID_LINK_ATTACHMENT':
      return 'El link no es válido. Tiene que ser una URL http(s).';
    case 'VALIDATION_ERROR':
      return 'El link no es válido. Revisá la URL.';
    case 'NO_ATTACHMENT':
      return 'No se seleccionó ningún archivo ni link.';
    case 'NEWS_POST_NOT_FOUND':
      return 'La noticia ya no existe.';
    default:
      return 'No se pudo subir el adjunto. Intentá de nuevo.';
  }
}

/**
 * NOC-broadcast errors, mapped by HTTP status (N1 typed errors bubble to the
 * global errorHandler with these statuses):
 *   503 NOC_BROADCAST_NOT_CONFIGURED, 502 EVOLUTION_API_ERROR,
 *   422 NOC_BROADCAST_LINK_BASE_MISSING, 404 NEWS_POST_NOT_FOUND.
 */
export function mapNewsBroadcastError(err: unknown): string {
  const { status } = readError(err);
  switch (status) {
    case 503:
      return 'Configurá la Difusión NOC primero.';
    case 502:
      return 'Error al conectar con Evolution / el Pi. Reintentá en un rato.';
    case 422:
      return 'Falta la URL pública en la config de Difusión NOC.';
    case 404:
      return 'La noticia ya no existe.';
    default:
      return 'No se pudo difundir la noticia. Intentá de nuevo.';
  }
}
