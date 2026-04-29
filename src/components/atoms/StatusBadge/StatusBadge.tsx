import styles from './StatusBadge.module.css';

type Status = 'active' | 'late' | 'blocked' | 'inactive';

const LABELS: Record<Status, string> = {
  active: 'Activo',
  late: 'Atrasado',
  blocked: 'Bloqueado',
  inactive: 'Inactivo',
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={[styles.badge, styles[status]].join(' ')}>
      {LABELS[status]}
    </span>
  );
}
