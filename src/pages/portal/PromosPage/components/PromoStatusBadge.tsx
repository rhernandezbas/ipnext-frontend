import type { PromoStatus } from '@/types/promos';
import { PROMO_STATUS_LABELS } from '@/utils/promoStatus';
import styles from './PromoStatusBadge.module.css';

interface PromoStatusBadgeProps {
  status: PromoStatus;
}

/**
 * PromoStatusBadge (promos-admin) — pill LOCAL para `PromoStatus`, mismo
 * criterio LOCKED que `TemplateApprovalBadge`/`CampaignStatusPill`: NO
 * extiende el union cerrado de `StatusBadge` (dominio de cliente
 * active/late/blocked/inactive/baja — un estado de promo NO es un estado de
 * cliente, forzar el mapeo sería una mentira semántica). El TEXTO del estado
 * SIEMPRE se muestra — nunca es solo color (WCAG 1.4.1, regla dura del
 * proposal: "el estado no puede comunicarse SOLO por color").
 */
export function PromoStatusBadge({ status }: PromoStatusBadgeProps) {
  return <span className={[styles.pill, styles[status]].join(' ')}>{PROMO_STATUS_LABELS[status]}</span>;
}
