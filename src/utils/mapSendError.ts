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
    // inbox-template-send (ERR-1, design D6/D9/D11) — errores del envío de
    // template (`SendTemplateMessage`, `POST .../send-template`). Misma
    // superficie de mapeo — el default de abajo queda intacto.
    case 'TEMPLATE_NOT_APPROVED':
      return 'Este template ya no está aprobado. Elegí otro de la lista.';
    case 'MISSING_TEMPLATE_VARIABLES':
      return 'Faltan variables del template por completar.';
    case 'TEMPLATE_SEND_REJECTED':
      return 'El proveedor rechazó el envío del template.';
    case 'TEMPLATE_PROVIDER_UNAVAILABLE':
      return 'El proveedor de WhatsApp no está disponible. Reintentá en unos minutos.';
    case 'TEMPLATE_PROVIDER_MISCONFIGURED':
      return 'El template no está configurado correctamente. Contactá a soporte.';
    case 'CONVERSATION_PHONE_MISSING':
      return 'Esta conversación no tiene un teléfono válido para enviar el template.';
    default:
      return 'No se pudo enviar el mensaje. Reintentá.';
  }
}
