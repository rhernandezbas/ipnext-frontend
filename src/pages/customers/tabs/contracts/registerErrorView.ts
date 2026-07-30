/**
 * gigared-tv-cic-reuse (FE) — mapeo PURO del error del alta de TV a lo que ve el operador.
 *
 * WHY existe este archivo: la lógica vivía inline en `GigaredPanel.tsx`, dentro de un `catch`,
 * y por eso NO TENÍA NI UN TEST. Se extrajo para poder fijarla, y en el mismo movimiento se
 * agregaron los dos códigos nuevos del backend (`TV_POOL_UNAVAILABLE`, `TV_NO_USABLE_CIC`)
 * que hasta ahora caían al fallback genérico.
 *
 * ⚠️ REGLA DE HONESTIDAD DEL COPY (deuda registrada en el BACKLOG el 2026-07-27): un mensaje
 * que dice "Reintentá" frente a un error que NUNCA va a resolverse reintentando es un bug, no
 * un detalle. Por eso `action` es parte del contrato de esta función y no una decisión suelta
 * del JSX: el TONO y la ACCIÓN se derivan de la naturaleza del error, no del gusto de cada
 * rama. 4xx de DATOS → sin reintento. 5xx TRANSITORIO → con reintento.
 */

export type RegisterErrorTone = 'warning' | 'error';
/** `retry` = re-postear el MISMO payload · `link` = saltar al flujo de vincular · `null` = nada. */
export type RegisterErrorAction = 'retry' | 'link' | null;

export interface RegisterErrorView {
  message: string;
  tone: RegisterErrorTone;
  action: RegisterErrorAction;
  /** true → el panel abre el modal dedicado de "pool agotado" en vez del banner. */
  poolExhaustedModal: boolean;
}

export function registerErrorView(
  code: string | null | undefined,
  detail?: string | null,
): RegisterErrorView {
  // #109 — pool de CICs agotado: modal dedicado, no banner.
  if (code === 'NO_CIC_AVAILABLE') {
    return { message: '', tone: 'error', action: null, poolExhaustedModal: true };
  }

  // FE-1a (422) — condición de DATOS: reintentar en loop no ayuda hasta limpiar el pool.
  if (code === 'TV_POOL_POISONED') {
    return {
      message:
        'No hay CICs limpios en el pool de Gigared; hace falta limpiar el pool antes de dar altas.',
      tone: 'error',
      action: null,
      poolExhaustedModal: false,
    };
  }

  // gigared-tv-cic-reuse (422) — se probaron varios CICs del pool y el partner los rechazó a
  // todos (no los reconoce como nuestros). Es de DATOS: SIN botón de reintentar, y el mensaje
  // dice qué hacer de verdad en vez de mandar al operador a reintentar para siempre.
  if (code === 'TV_NO_USABLE_CIC') {
    return {
      message:
        'Ninguno de los CICs disponibles sirve: Gigared no los reconoce como nuestros. ' +
        'Hay que pedirle a Gigared que los revise — reintentar no va a cambiar el resultado.',
      tone: 'error',
      action: null,
      poolExhaustedModal: false,
    };
  }

  // gigared-tv-cic-reuse (503) — no se pudo LEER el pool. Transitorio: mismo trato que
  // TV_IDENTITY_UNVERIFIED (tono suave + reintentar). El `detail` crudo del upstream NO se
  // muestra: al operador "Request failed with status code 500" no le sirve para nada.
  if (code === 'TV_POOL_UNAVAILABLE') {
    return {
      message: 'No se pudo consultar el pool de CICs de Gigared. Reintentá en unos segundos.',
      tone: 'warning',
      action: 'retry',
      poolExhaustedModal: false,
    };
  }

  // FE-1b (503) — el readback post-stamp no confirmó la identidad: transitorio, el retry se
  // auto-completa vía el recovery del BE (D2).
  if (code === 'TV_IDENTITY_UNVERIFIED') {
    return {
      message: 'No se pudo verificar la identidad en Gigared. Reintentá.',
      tone: 'warning',
      action: 'retry',
      poolExhaustedModal: false,
    };
  }

  // FE-2 (409) — el email determinístico ya está bindeado a OTRA cuenta.
  if (code === 'TV_EMAIL_OWNED_BY_OTHER') {
    return {
      message: 'Ya existe una cuenta de TV con este email, vinculada a otro cliente.',
      tone: 'warning',
      action: 'link',
      poolExhaustedModal: false,
    };
  }

  // #47g-3 — el partner manda un `detail` humano en los 422 GIGARED_REJECTED y en los
  // 502/503 upstream: se muestra verbatim, con fallback genérico.
  return {
    message:
      code === 'GIGARED_REJECTED'
        ? (detail ?? 'Gigared rechazó el registro. Revisá los datos.')
        : detail
          ? `No se pudo registrar: ${detail}`
          : 'No se pudo registrar la cuenta. Reintentá.',
    tone: 'error',
    action: null,
    poolExhaustedModal: false,
  };
}
