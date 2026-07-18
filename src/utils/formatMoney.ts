const ISO_4217_CODE = /^[A-Z]{3}$/;

/**
 * ARS money, consistente con `BillingTab.tsx` ("$ 1.234,56"). Extraído de
 * `FinancialSection.tsx` (panel de contexto del inbox) para que el
 * `TemplateSendPanel` (FUENTES: variable "Monto de deuda") resuelva el monto
 * EXACTAMENTE como el operador lo ve en el panel — una sola fuente de formateo.
 *
 * Fix bug BAJO (review adversarial, heredado): `currency ?? 'ARS'` solo cubría
 * `null`/`undefined` — un `""` o un código no-ISO (mirror del BE desalineado)
 * llegaba crudo a `Intl.NumberFormat`, que tira `RangeError: Invalid currency
 * code` y rompe el render entero. Se valida el shape (3 letras mayúsculas)
 * antes de confiar en el valor; cualquier otra cosa cae a ARS.
 */
export function formatMoney(amount: number, currency: string | null): string {
  const safeCurrency = currency && ISO_4217_CODE.test(currency) ? currency : 'ARS';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency }).format(amount);
}
