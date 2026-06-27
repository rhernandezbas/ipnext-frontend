/**
 * ServiceEventType — fuente canónica FE del enum de eventos de servicio.
 *
 * ESPEJA el union del BE en:
 *   ipnext-backend/src/application/dto/contract-services.dto.ts:88
 *
 * Regla de mantenimiento: si el BE agrega un valor a ese union, agregarlo
 * aquí Y en cada Record<ServiceEventType, ...> que exista en el FE.
 * El compilador TypeScript reportará los mapas incompletos como error.
 *
 * Mapas que deben mantenerse en sync:
 *   - EVENT_LABELS en ServiceHistoryModal.tsx
 *   - EVENT_REASON_TITLES en ServiceHistoryModal.tsx
 *   - EVENT_TYPE_LABELS en InternetActivationHistoryModal.tsx
 */
export type ServiceEventType =
  | 'activated'
  | 'deactivated'
  | 'reactivated'
  | 'reduced'
  | 'blocked'
  | 'restored'
  | 'modified';

/**
 * Array en runtime de todos los valores de ServiceEventType.
 * Útil para tests de contrato y para iterar los valores posibles.
 */
export const SERVICE_EVENT_TYPES: readonly ServiceEventType[] = [
  'activated',
  'deactivated',
  'reactivated',
  'reduced',
  'blocked',
  'restored',
  'modified',
] as const;
