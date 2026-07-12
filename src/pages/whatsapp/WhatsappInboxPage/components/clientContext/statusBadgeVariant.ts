/**
 * statusBadgeVariant — helper compartido de `clientContext/*` (messaging-inbox-v2
 * F1.5). `CandidatePicker` recibe `status` como `string` genérico (mirror del
 * `CustomerStatus`, tipado ancho en `WhatsappClientContextClient` — F1) pero el
 * átomo `StatusBadge` exige el union CERRADO de 5 valores. Narrowing seguro:
 * si el valor no está en el set conocido, cae a `'inactive'` en vez de
 * romper el render (defensive, dato de un catálogo que puede evolucionar).
 */
export type StatusBadgeVariant = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

const KNOWN_STATUSES: ReadonlySet<string> = new Set(['active', 'late', 'blocked', 'inactive', 'baja']);

export function toStatusBadgeVariant(status: string): StatusBadgeVariant {
  return KNOWN_STATUSES.has(status) ? (status as StatusBadgeVariant) : 'inactive';
}
