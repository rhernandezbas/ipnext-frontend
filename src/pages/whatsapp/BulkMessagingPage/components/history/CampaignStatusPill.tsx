import type { CampaignStatusDto } from '@/types/messagingBulk';
import styles from './CampaignStatusPill.module.css';

const LABELS: Record<CampaignStatusDto, string> = {
  pending: 'Pendiente',
  running: 'Enviando',
  paused: 'Pausada',
  done: 'Completada',
  failed: 'Fallida',
};

interface CampaignStatusPillProps {
  status: CampaignStatusDto;
}

/**
 * CampaignStatusPill (F2 apply chunk 3, HIST-1/HIST-2) — pill LOCAL para
 * `CampaignStatusDto`, decisión LOCKED del explore: NO extiende el union
 * cerrado de `StatusBadge` (mismo criterio que `--badge-paid-*` en
 * `FinancialSection`, ver comentario en `variables.css`). El TEXTO del
 * estado siempre se muestra — nunca es solo color (WCAG 1.4.1). Contraste
 * >=4.5:1 verificado para los 5 estados (ver `variables.css`, tokens
 * `--badge-active-*`/`--badge-paused-*`/`--badge-paid-*`/`--badge-late-*`
 * y los neutros `--color-gray-100`/`--color-gray-700`).
 */
export function CampaignStatusPill({ status }: CampaignStatusPillProps) {
  return <span className={[styles.pill, styles[status]].join(' ')}>{LABELS[status]}</span>;
}
