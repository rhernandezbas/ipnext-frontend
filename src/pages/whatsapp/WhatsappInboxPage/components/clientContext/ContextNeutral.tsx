import styles from '../ClientContextPanel.module.css';

interface ContextNeutralProps {
  message: string;
}

/**
 * ContextNeutral — estado neutro del panel (messaging-inbox-v2 F1.5, design
 * §4): "ausente" (lightContext todavía no llegó) o "unknown" (sin match).
 * Puro, sin lógica — el container decide el mensaje.
 */
export function ContextNeutral({ message }: ContextNeutralProps) {
  return <p className={styles['st-neutral']}>{message}</p>;
}
