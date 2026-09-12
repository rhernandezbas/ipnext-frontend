/**
 * suricata-tickets-mirror (Fase I, task I.3, spec REPLY-5) — traduce los
 * códigos de error de `POST /api/suricata/tickets/:id/reply`
 * (`ipnext-backend/src/domain/errors/suricata.ts` + `errorHandler.ts`'s
 * `statusMap`) a un mensaje honesto en español, mismo patrón que
 * `mapTicketMessageError.ts`.
 *
 * `SURICATA_UNAVAILABLE` (502) es el caso que se ve SIEMPRE hoy: Fase E
 * conecta `UnavailableSuricataReplyPort` incondicionalmente hasta que la
 * Fase J (sidecar Playwright) exista — así que este mensaje es
 * deliberadamente honesto sobre el estado real de la capacidad ("todavía no
 * está disponible"), no un error crudo de red ni un falso "enviado" (REPLY-5:
 * "the system MUST NOT report success when the message was not actually
 * delivered").
 */
export function mapSuricataReplyError(err: unknown): string {
  const data = (err as { response?: { data?: { code?: string } } })?.response?.data;
  const code = data?.code;
  switch (code) {
    case 'SURICATA_UNAVAILABLE':
      return 'El envío automático a Suricata todavía no está disponible. Por ahora, respondé al cliente por otro canal.';
    case 'SURICATA_SESSION_BUSY':
      return 'La sesión de Suricata está ocupada en este momento. Probá de nuevo en unos segundos.';
    case 'REPLY_CONFIRMATION_MISMATCH':
      return 'La confirmación no coincide con el texto a enviar. Volvé a intentarlo.';
    case 'FEATURE_DISABLED':
      return 'El envío de respuestas a Suricata está deshabilitado en este momento.';
    case 'SURICATA_TICKET_NOT_FOUND':
      return 'Este ticket ya no existe en el espejo.';
    default:
      return 'No se pudo enviar la respuesta. Intentá de nuevo.';
  }
}
