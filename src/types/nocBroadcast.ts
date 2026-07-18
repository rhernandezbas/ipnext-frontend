/**
 * NOC Broadcast (Difusión NOC) configuration — mirrors the backend DTO exactly.
 *
 *   GET  /messaging/noc-broadcast/config → NocBroadcastConfigDTO (apiKey enmascarada)
 *   PUT  /messaging/noc-broadcast/config → partial UpdateNocBroadcastPayload → mismo DTO
 *   POST /messaging/noc-broadcast/test   → { ok: true }
 *
 * La apiKey NUNCA viaja completa hacia el cliente: el DTO solo expone `hasApiKey`
 * (hay una key guardada) y `apiKeyLast4` (últimos 4 caracteres, para reconocerla).
 * En el PUT, `evolutionApiKey` vacío/ausente PRESERVA la key ya guardada — solo se
 * envía cuando el usuario escribe una nueva.
 */
export interface NocBroadcastConfigDTO {
  /** Difusión habilitada (el envío real está gateado por esto + configured). */
  enabled: boolean;
  /** URL del Evolution API en el Pi (ej. http://192.168.x.x:8080). http(s). */
  evolutionBaseUrl: string;
  /** Nombre de la instancia de Evolution (ej. "ronald noc"). */
  evolutionInstance: string;
  /** JID del canal "noc lider" en Evolution (ej. 12036...@g.us). */
  targetChat: string;
  /** URL pública de la app para los links de los mensajes (ej. http://190.7.234.37:7778). http(s). */
  appPublicUrl: string;
  /** Hay una API key guardada en la DB. */
  hasApiKey: boolean;
  /** Últimos 4 caracteres de la key guardada (o null si no hay). NUNCA la key entera. */
  apiKeyLast4: string | null;
  /** Está lista para usar (todos los campos requeridos + key presentes). */
  configured: boolean;
}

/**
 * Partial body accepted by `PUT /messaging/noc-broadcast/config` (Zod partial en
 * el BE). Solo se envían los campos que el usuario cambió. `evolutionApiKey` se
 * envía EXCLUSIVAMENTE cuando el usuario escribe una key nueva: ausente/vacío
 * preserva la guardada (no la borra).
 */
export interface UpdateNocBroadcastPayload {
  enabled?: boolean;
  evolutionBaseUrl?: string;
  evolutionInstance?: string;
  targetChat?: string;
  appPublicUrl?: string;
  evolutionApiKey?: string;
}

/** Resultado del POST /test — el BE responde { ok: true } tras enviar la prueba. */
export interface TestNocBroadcastResult {
  ok: boolean;
}
