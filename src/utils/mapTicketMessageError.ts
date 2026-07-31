/**
 * Traduce los códigos de error del BE de "Responder al cliente"
 * (POST /:ticketId/messages) a un mensaje en español accionable — mismo
 * patrón que `mapUploadError.ts` (fotos de tareas). Fuente de los códigos:
 * `domain/errors/ticketMessage.ts` (dominio) + `ticketMessageUpload.ts`
 * (traducción de multer a 4xx) del backend.
 */
const TICKET_MESSAGE_MAX_ATTACHMENTS = 5;
const TICKET_MESSAGE_MAX_TOTAL_BATCH_MB = 60;

export function mapTicketMessageError(err: unknown): string {
  const data = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data;
  const code = data?.code;
  switch (code) {
    case 'UNSUPPORTED_TICKET_MESSAGE_ATTACHMENT_TYPE':
      return 'Formato no soportado. Solo imagen, audio o video de los tipos permitidos.';
    case 'TICKET_MESSAGE_ATTACHMENT_TOO_LARGE':
    case 'FILE_TOO_LARGE':
      return 'Alguno de los archivos supera el límite de tamaño de su categoría.';
    case 'BATCH_TOO_LARGE':
      return `El tamaño combinado de los adjuntos supera el límite de ${TICKET_MESSAGE_MAX_TOTAL_BATCH_MB}MB por envío.`;
    case 'TOO_MANY_TICKET_MESSAGE_ATTACHMENTS':
    case 'TOO_MANY_FILES':
      return `Máximo ${TICKET_MESSAGE_MAX_ATTACHMENTS} adjuntos por respuesta.`;
    case 'TICKET_MESSAGE_VALIDATION':
      return 'El mensaje no puede estar vacío (o supera el largo máximo permitido).';
    case 'TICKET_MESSAGE_STORAGE_UNAVAILABLE':
      return 'El almacenamiento de adjuntos no está disponible por ahora. Probá de nuevo en unos minutos.';
    case 'TICKET_NOT_FOUND':
      return 'El ticket ya no existe.';
    case 'UNEXPECTED_FIELD':
    case 'UPLOAD_ERROR':
    default:
      return 'No se pudo enviar la respuesta. Intentá de nuevo.';
  }
}
