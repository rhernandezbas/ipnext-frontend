import type { ScheduledTask } from '@/types/scheduling';
import styles from './IClassStatusBadge.module.css';

interface IClassStatusBadgeProps {
  /** El campo iclassStatus del ScheduledTask. */
  iclassStatus: ScheduledTask['iclassStatus'];
}

/**
 * Badge del estado actual de la OS en IClass.
 * Solo se renderiza cuando `iclassStatus` existe Y `tracked === true`.
 * Los estados con `tracked === false` no se muestran (el operador los ocultó).
 * Cuando `color` está presente se usa como fondo; si no, cae al estilo neutro.
 */
export function IClassStatusBadge({ iclassStatus }: IClassStatusBadgeProps) {
  if (!iclassStatus || !iclassStatus.tracked) return null;

  const { label, color } = iclassStatus;

  // Cuando hay color de fondo, lo usamos directamente con transparencia para
  // no saturar el header. Si no hay color, usamos la clase CSS por defecto.
  const style = color
    ? { background: `${color}22`, color, borderColor: `${color}55` }
    : undefined;

  return (
    <span
      className={styles.badge}
      style={style}
      data-testid="iclass-status-badge"
      aria-label={`Estado IClass: ${label}`}
    >
      {color && <span className={styles.dot} style={{ background: color }} aria-hidden="true" />}
      {label}
    </span>
  );
}
