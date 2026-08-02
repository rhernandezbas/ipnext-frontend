/**
 * store-admin — helpers de números decimales para el input de precio (es-AR:
 * '.' miles, ',' decimal) y para leer `priceArs`/`priceArsAtOrder` del BE, que
 * puede serializar un `Decimal` de Prisma como `string` o `number` según el
 * endpoint (contrato del proposal, "manejá ambos").
 */

/**
 * Parsea un input tipeado en formato es-AR ("45.000,50") a un `number`
 * honesto (45000.5). Devuelve `null` si el string no representa un número
 * finito no-negativo — NUNCA hay que mandar `NaN` ni el string crudo al BE.
 *
 * Reglas:
 *  - Si hay coma, TODOS los puntos son separadores de miles (se descartan) y
 *    la coma es el separador decimal.
 *  - Si NO hay coma, se acepta un único punto como separador decimal
 *    (defensivo: pegar un valor "45000.50" con formato US no debe romper).
 *  - Cualquier otro caracter (letras, múltiples comas, signo) invalida.
 */
export function parseArDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Coerce un decimal del BE (`string | number`) a `number`. `NaN`/inválido →
 * `0` — usado SOLO para display (precio de fila, preview de cuota); nunca
 * para armar un payload de mutación (ahí se usa `parseArDecimal` sobre el
 * input real del operador).
 */
export function toDecimalNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
