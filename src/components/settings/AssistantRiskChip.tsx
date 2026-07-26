import { RISK_LABELS, type AssistantRiskLevel } from '@/types/assistant';
import styles from './AssistantRiskChip.module.css';

interface AssistantRiskChipProps {
  level: AssistantRiskLevel;
}

/**
 * ai-assistant-multiagent — nivel de riesgo de una acción del asistente.
 *
 * El texto ("Bajo"/"Medio"/"Alto") es parte del chip, no un adorno: el color NUNCA puede ser
 * la única señal de estado (WCAG 1.4.1). Un operador daltónico tiene que poder distinguir
 * "comentar internamente" de "marcar la conversación como resuelta" — y esa diferencia es la
 * que decide si un reclamo vivo queda enterrado.
 */
export function AssistantRiskChip({ level }: AssistantRiskChipProps) {
  return (
    <span className={`${styles.chip} ${styles[level]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {RISK_LABELS[level]}
    </span>
  );
}
