/**
 * gestion-app — espejo del contrato de los avisos push de SERVICIO
 * (`POST /api/notifications/push-service-alert[/preview]`, permiso `push.send`).
 * Verificado contra el BE real: `PreviewPushServiceAlert`/`SendPushServiceAlert`
 * en `ipnext-backend/src/application/use-cases/notifications/`.
 *
 * Promociones NO se mandan por acá: el BE lo dejó explícitamente fuera (la
 * preferencia `promos` existe y es auditable, pero nada la usa para enviar).
 */

/** Respuesta del preview — conteos REALES (mismo resolver que el envío), cero efectos. */
export interface PushServiceAlertPreview {
  /** Cuentas de portal con al menos un dispositivo apto (opt-in + token vivo). */
  recipients: number;
  /** Tokens/dispositivos a los que se intentaría mandar. */
  devices: number;
}

/** Respuesta del envío real. */
export interface PushServiceAlertResult {
  recipients: number;
  devices: number;
  /** Tokens que FCM reportó muertos en ESTE envío (ya quedaron invalidados en el BE). */
  invalidated: number;
  /**
   * `true` = el BE está corriendo con el `PushSender` stub (Firebase SIN
   * configurar): NO se envió nada. Hay que decírselo al operador con todas las
   * letras — si no, se va convencido de que el aviso salió.
   */
  dryRun: boolean;
  /**
   * Filas de buzón (`PortalNotification`) creadas. Universo del filtro de nodo
   * COMPLETO — no mira `serviceAlerts`, así que casi siempre es >= `recipients`.
   */
  inboxed: number;
}
