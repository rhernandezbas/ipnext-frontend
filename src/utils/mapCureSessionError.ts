/**
 * Mapeo de los errores tipados del POST /radius/session-cures (radius-session-autocure
 * FE-1, REQ-FE-CURE-2) a decisiones/mensajes del flujo de doble confirmación. El BE
 * responde `{ code, message }` en los 409/502 — los códigos son la fuente de verdad
 * (molde mapPppoeMoveError.ts / lección #28: contrato campo por campo).
 *
 * Los DOS gates fail-closed (alive/ambiguous) son la ÚNICA vía al segundo confirm con
 * `force: true` — nunca se manda force automáticamente. El 502 orchestrator caído es
 * una falla real de infraestructura, NO un gate: no se ofrece "forzar" ahí (forzar no
 * arregla que el orchestrator esté caído).
 */

interface CureErrorResponse {
  status?: number;
  data?: { code?: string; message?: string };
}

function responseOf(err: unknown): CureErrorResponse | undefined {
  return (err as { response?: CureErrorResponse })?.response;
}

export const CURE_SKIPPED_ALIVE_CODE = 'CURE_SKIPPED_ALIVE';
export const CURE_SKIPPED_AMBIGUOUS_CODE = 'CURE_SKIPPED_AMBIGUOUS';
export const ORCHESTRATOR_UNREACHABLE_CODE = 'ORCHESTRATOR_UNREACHABLE';

/** 409 — el gate fail-closed detectó la sesión posiblemente VIVA. */
export function isCureSkippedAlive(err: unknown): boolean {
  const r = responseOf(err);
  return r?.status === 409 && r.data?.code === CURE_SKIPPED_ALIVE_CODE;
}

/** 409 — el gate fail-closed detectó sesiones en NAS distintos (estado ambiguo). */
export function isCureSkippedAmbiguous(err: unknown): boolean {
  const r = responseOf(err);
  return r?.status === 409 && r.data?.code === CURE_SKIPPED_AMBIGUOUS_CODE;
}

/** Cualquiera de los dos gates fail-closed que el operador puede saltear con `force`. */
export function isCureGateRejection(err: unknown): boolean {
  return isCureSkippedAlive(err) || isCureSkippedAmbiguous(err);
}

/** 502 — el orchestrator no respondió. NO es un gate: forzar no lo arregla. */
export function isOrchestratorUnreachable(err: unknown): boolean {
  const r = responseOf(err);
  return r?.status === 502 && r.data?.code === ORCHESTRATOR_UNREACHABLE_CODE;
}

/** El motivo REAL que mandó el BE (`message`, espejo de `result.reason`), con fallback. */
export function cureErrorReason(err: unknown, fallback: string): string {
  const r = responseOf(err);
  return r?.data?.message ?? fallback;
}
