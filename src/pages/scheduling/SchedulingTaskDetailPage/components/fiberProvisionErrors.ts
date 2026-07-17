/**
 * smartolt-provision-fe (K2-FE) — mapeo de errores del BE a copy humano.
 * Cada código del contrato K2 tiene su mensaje específico (regla del change:
 * nada de "Error 409" pelado). Fallback defensivo para códigos desconocidos.
 */
const FIBER_ERROR_COPY: Record<string, string> = {
  // 400
  VALIDATION_ERROR: 'Datos inválidos — revisá la VLAN (tiene que ser un número entre 1 y 4094) y reintentá.',
  // 404
  CONTRACT_NOT_FOUND: 'El contrato vinculado a la tarea no existe en Prominense.',
  ONU_NOT_FOUND: 'La ONU ya no figura como no-configurada en SmartOLT — refrescá la lista.',
  SMARTOLT_OLT_NOT_FOUND: 'La OLT de esa ONU no está en el catálogo de SmartOLT.',
  // 409
  FIBER_PROVISION_DISABLED: 'El aprovisionamiento automático está apagado — se prende desde el flag fiber-auto-provision.',
  ONU_NOT_AUTHORIZABLE: 'SmartOLT todavía no ofrece autorizar esa ONU — refrescá la lista o verificála en SmartOLT.',
  // 422
  ONU_NOT_HUAWEI: 'Esa ONU no es Huawei — solo Huawei se auto-aprovisiona.',
  FIBER_VLAN_REQUIRED: 'Esta OLT no tiene VLAN default — ingresá la VLAN de servicio para continuar.',
  SMARTOLT_REJECTED: 'SmartOLT rechazó la operación — revisá la ONU en SmartOLT antes de reintentar.',
  // 502 / 503
  SMARTOLT_UNREACHABLE: 'No se pudo contactar a SmartOLT — reintentá en unos minutos.',
  SMARTOLT_NOT_CONFIGURED: 'SmartOLT no está configurado en el servidor (envs) — avisale al administrador.',
};

/**
 * H2a — prefijo de honestidad para errores de la EJECUCIÓN real: los 7 calls
 * son seriales y el error puede llegar con pasos ya aplicados. El dry-run NO
 * lleva este prefijo (no tiene side-effects).
 */
export const EXECUTION_UNCERTAIN_PREFIX =
  '⚠ El aprovisionamiento pudo quedar A MEDIAS — verificá el estado real en SmartOLT antes de reintentar.';

/**
 * Extrae `response.data.code` de un error axios-like y lo mapea a copy humano.
 * `perm` (L1): el GET de la lista exige network.read y el POST network.manage —
 * el copy del 401/403 nombra el permiso que corresponde a la operación.
 */
export function mapFiberError(
  err: unknown,
  perm: 'network.read' | 'network.manage' = 'network.manage',
): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number; data?: { code?: string; error?: string } } }).response;
    const code = res?.data?.code;
    if (code && FIBER_ERROR_COPY[code]) return FIBER_ERROR_COPY[code];
    if (res?.status === 401 || res?.status === 403) {
      return perm === 'network.read'
        ? 'No tenés permiso para ver las ONUs sin configurar (requiere network.read).'
        : 'No tenés permiso para aprovisionar ONUs (requiere network.manage).';
    }
  }
  return 'Error inesperado al hablar con el servidor. Reintentá.';
}
