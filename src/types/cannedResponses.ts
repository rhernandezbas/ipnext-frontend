/**
 * cannedResponses (Ola 4 — respuestas rápidas / macros del composer). Espejo
 * del router `/api/messaging/canned-responses` del BE (ya en prod):
 *
 * - GET    /canned-responses?q= (gate `messaging:read`)   → { data: CannedResponse[] }
 * - POST   /canned-responses    (gate `messaging:manage`) → 201
 * - PUT    /canned-responses/:id (gate `messaging:manage`) → 200
 * - DELETE /canned-responses/:id (gate `messaging:manage`) → 204
 *
 * Errores (body `{error, code}`): 409 SHORTCUT_TAKEN, 404
 * CANNED_RESPONSE_NOT_FOUND, 400 VALIDATION_ERROR.
 */

export interface CannedResponse {
  id: string;
  /** Atajo corto (ej. "saludo") — lo que el agente tipea para encontrarla. Único por cuenta (409 SHORTCUT_TAKEN). */
  shortcut: string;
  /** Texto que se inserta en el composer. Puede incluir `{{variables}}` v1 SIN resolver (van literales). */
  content: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** Body del POST `/canned-responses`. */
export interface CreateCannedResponseInput {
  shortcut: string;
  content: string;
}

/** Body del PUT `/canned-responses/:id` — ambos opcionales (edición parcial). */
export interface UpdateCannedResponseInput {
  shortcut?: string;
  content?: string;
}
