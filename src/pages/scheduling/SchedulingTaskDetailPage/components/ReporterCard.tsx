import type { Admin } from '@/types/admin';
import styles from './SideCard.module.css';

interface ReporterCardProps {
  reporterId: string | null;
  allAdmins: Admin[];
}

export function ReporterCard({ reporterId, allAdmins }: ReporterCardProps) {
  const reporter = reporterId ? allAdmins.find(a => a.id === reporterId) : null;

  return (
    <section className={styles.card} aria-labelledby="reporter-heading">
      <h2 id="reporter-heading" className={styles.cardTitle}>Reporter</h2>
      {reporter ? (
        <div className={styles.cardContent}>
          <span className={styles.avatar}>{reporter.name.charAt(0).toUpperCase()}</span>
          <span className={styles.name}>{reporter.name}</span>
        </div>
      ) : (
        <p className={styles.emptyText}>Sin reporter asignado</p>
      )}
    </section>
  );
}
