import styles from '../ClientContextPanel.module.css';

interface ContextErrorProps {
  onRetry: () => void;
}

/**
 * ContextError — estado "error sin data previa" (messaging-inbox-v2 F1.5,
 * design §4). Compacto + botón "Reintentar" que dispara `refetch()` del hook.
 */
export function ContextError({ onRetry }: ContextErrorProps) {
  return (
    <div className={styles['st-error']} role="alert">
      <p className={styles['st-errorText']}>No se pudo cargar el contexto del cliente.</p>
      <button type="button" className={styles['st-retryBtn']} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
