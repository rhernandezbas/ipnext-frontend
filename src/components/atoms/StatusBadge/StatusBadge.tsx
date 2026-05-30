import styles from './StatusBadge.module.css';

type Status = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

const LABELS: Record<Status, string> = {
  active: 'Activo',
  late: 'Atrasado',
  blocked: 'Bloqueado',
  inactive: 'Inactivo',
  baja: 'Bajas',
};

interface StatusBadgeProps {
  status: Status;
  /**
   * Optional copy override. The badge `status` is a PRESENTATION variant (color);
   * consumers that reuse a variant for a different domain (e.g. finance pages reusing
   * `blocked`/`late` by color, or the client pages showing GR vocabulary) can supply
   * their own label without changing the shared default for every other page.
   */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={[styles.badge, styles[status]].join(' ')}>
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
