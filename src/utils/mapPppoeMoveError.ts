/**
 * Mapeo de los errores tipados del POST /pppoe/:id/move (pppoe-move-nas W1) a
 * mensajes humanos en español. El BE responde { code, error }; los códigos son
 * la fuente de verdad (lección #28: contrato campo por campo).
 */

interface MoveErrorResponse {
  status?: number;
  data?: { code?: string; error?: string };
}

function responseOf(err: unknown): MoveErrorResponse | undefined {
  return (err as { response?: MoveErrorResponse })?.response;
}

export const PPPOE_MOVE_PUBLIC_IP_CODE = 'PPPOE_MOVE_PUBLIC_IP';

/**
 * ¿El BE rechazó el move porque la IP actual es PÚBLICA fija (409
 * PPPOE_MOVE_PUBLIC_IP)? Es la señal del paso 1 del flujo force (S9.3): el FE
 * NO clasifica la IP — solo reacciona al código del BE.
 */
export function isPppoeMovePublicIpError(err: unknown): boolean {
  const r = responseOf(err);
  return r?.status === 409 && r.data?.code === PPPOE_MOVE_PUBLIC_IP_CODE;
}

const GENERIC_MESSAGE = 'No se pudo mover el PPPoE al nuevo NAS.';

/** Mensaje claro por código/status — NUNCA deja al operador sin feedback. */
export function mapPppoeMoveError(err: unknown): string {
  const r = responseOf(err);
  switch (r?.data?.code) {
    case 'NO_FREE_IP':
      return 'El pool del NAS destino no tiene IPs libres.';
    /**
     * pppoe-move-ip-kind-aware: el mensaje ya NO hardcodea "CGNAT".
     *
     * El error del dominio viene parametrizado (`El NAS <id> no tiene un pool '<cgnat|public>'`)
     * pero el FE lo aplanaba a CGNAT siempre. Acertaba por casualidad mientras el move pedía
     * cgnat a la fuerza; con la resolución por destino y el camino de adopción, la clase puede
     * ser `public` y el mensaje mentiría — mandando al operador a buscar un pool CGNAT que no
     * es el problema.
     */
    case 'NO_POOL_FOR_NAS_TYPE': {
      const raw = r?.data?.error ?? '';
      if (raw.includes("'public'")) return 'El NAS destino no tiene pool de IPs públicas configurado.';
      if (raw.includes("'cgnat'"))  return 'El NAS destino no tiene pool de IPs privadas (CGNAT) configurado.';
      return 'El NAS destino no tiene un pool del tipo de IP requerido.';
    }
    // 404s: mensaje propio en español — el `error` crudo del BE viene en inglés.
    case 'PPPOE_NOT_FOUND':
      return 'El servicio PPPoE ya no existe (¿fue dado de baja?).';
    case 'NAS_NOT_FOUND':
      return 'El NAS destino ya no existe.';
    case 'PPPOE_TERMINATED':
    case 'PPPOE_MOVE_MIXED_NAS_TYPES':
    case 'ORCHESTRATOR_REJECTED':
      return r?.data?.error ?? GENERIC_MESSAGE;
    default:
      break;
  }
  if (r?.status === 502) return 'No se pudo contactar el RADIUS. Reintentá.';
  return r?.data?.error ?? GENERIC_MESSAGE;
}
