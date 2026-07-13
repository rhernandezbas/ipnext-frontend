import { MAX_FILES } from './validateAttachment';

/**
 * mapSendError (messaging-inbox-v2-media F1.5 fase A, Tanda 2, design §6.4)
 * — molde `mapUploadError.ts`. Traduce el `code` del BE (`errorHandler.ts`,
 * `spec-send.md`) a un mensaje humano en español para el envío de media.
 */
export function mapSendError(err: unknown): string {
  const data = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data;
  const code = data?.code ?? data?.error;
  switch (code) {
    case 'UNSUPPORTED_ATTACHMENT_TYPE':
      return 'Ese tipo de archivo no se puede enviar por WhatsApp.';
    case 'ATTACHMENT_TOO_LARGE':
    case 'FILE_TOO_LARGE':
      return 'Un archivo supera el tamaño máximo permitido.';
    case 'TOO_MANY_FILES':
      return `Máximo ${MAX_FILES} archivos por mensaje.`;
    case 'MESSAGING_WINDOW_EXPIRED':
      return 'La ventana de 24 horas expiró. Se necesita una plantilla.';
    case 'CHATWOOT_UNAVAILABLE':
      return 'El servicio de mensajería no está disponible. Reintentá en unos minutos.';
    case 'CONVERSATION_NOT_FOUND':
      return 'Esta conversación ya no existe.';
    default:
      return 'No se pudo enviar el mensaje. Reintentá.';
  }
}
