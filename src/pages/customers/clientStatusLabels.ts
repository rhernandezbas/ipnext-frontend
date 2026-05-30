/**
 * Customer-domain status labels (Gestión Real vocabulary).
 *
 * The shared `StatusBadge` atom keeps NEUTRAL defaults (`blocked → 'Bloqueado'`,
 * `late → 'Atrasado'`) because it is reused across finance pages by COLOR. Client
 * pages override those defaults with GR copy by passing
 * `label={CLIENT_STATUS_LABELS[status]}` to the badge. Kept per-page (customers
 * domain) on purpose — there is no central status-label registry in this codebase.
 */
export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  late: 'Deudor',
  blocked: 'Incobrable',
  inactive: 'Inactivo',
  baja: 'Bajas',
};
