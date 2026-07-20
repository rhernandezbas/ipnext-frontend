import type { TemplateApprovalStatus } from '@/types/messagingTemplates';
import styles from './TemplateApprovalBadge.module.css';

const LABELS: Record<TemplateApprovalStatus, string> = {
  approved: 'Aprobado',
  pending: 'En revisión',
  rejected: 'Rechazado',
  unsubmitted: 'Borrador',
};

interface TemplateApprovalBadgeProps {
  status: TemplateApprovalStatus;
}

/**
 * TemplateApprovalBadge (Change 3) — pill LOCAL del status de aprobación de
 * Meta. NO extiende el union CERRADO de `StatusBadge` (active/late/blocked/
 * inactive/baja — sin verde ni ámbar), mismo criterio LOCKED que
 * `CampaignStatusPill` y el pill "al día" de `FinancialSection` (ver comentario
 * en `variables.css`). Forzar `approved→active`(azul) o `pending→blocked`
 * (naranja) sería una MENTIRA de color.
 *
 * El TEXTO del estado SIEMPRE se muestra — nunca es solo color (WCAG 1.4.1).
 * Contraste >=4.5:1 verificado con los tokens reusados (todos comentados en
 * `variables.css`): approved `--badge-paid-*` (#166534 sobre #dcfce7 ≈7:1),
 * pending `--badge-paused-*` (#92400e sobre #fef3c7 ≈6.39:1), rejected
 * `--badge-late-*` (#991b1b sobre #fee2e2), unsubmitted gris
 * `--color-gray-700` sobre `--color-gray-100`.
 */
export function TemplateApprovalBadge({ status }: TemplateApprovalBadgeProps) {
  return <span className={[styles.pill, styles[status]].join(' ')}>{LABELS[status]}</span>;
}
