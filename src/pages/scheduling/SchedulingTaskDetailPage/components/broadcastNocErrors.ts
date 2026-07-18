/**
 * task-broadcast-fe (N3-FE) — mapeo de los errores tipados del POST
 * /scheduling/:id/broadcast-noc a copy humano en español. El envelope del BE es
 * `{ error, code }` (ver errorHandler.ts). Cada código del contrato tiene su
 * mensaje específico; fallback defensivo para códigos desconocidos.
 */
const BROADCAST_NOC_ERROR_COPY: Record<string, string> = {
  // 503 — la Difusión NOC no está configurada/habilitada (envs/config del motor).
  NOC_BROADCAST_NOT_CONFIGURED:
    'Configurá la Difusión NOC primero (Config → WhatsApp → Difusión NOC).',
  // 502 — Evolution/Pi caído o inalcanzable.
  EVOLUTION_API_ERROR: 'Error hablando con Evolution/Pi — revisá la conexión.',
  // 422 — falta appPublicUrl en la config (sin base no se arma el link del mensaje).
  NOC_BROADCAST_LINK_BASE_MISSING:
    'Falta la URL pública de la app en la config de Difusión NOC.',
  // 422 — la tarea no es de red (solo kind='network' se difunde).
  TASK_NOT_BROADCASTABLE: 'Solo las tareas de red se envían al NOC.',
  // 404
  TASK_NOT_FOUND: 'Tarea no encontrada.',
};

/**
 * Extrae `response.data.code` de un error axios-like y lo mapea a copy humano.
 * Fallback para códigos desconocidos / errores sin envelope.
 */
export function mapBroadcastNocError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { code?: string; error?: string } } }).response;
    const code = res?.data?.code ?? res?.data?.error;
    if (code && BROADCAST_NOC_ERROR_COPY[code]) return BROADCAST_NOC_ERROR_COPY[code];
  }
  return 'No se pudo enviar al NOC. Reintentá.';
}
