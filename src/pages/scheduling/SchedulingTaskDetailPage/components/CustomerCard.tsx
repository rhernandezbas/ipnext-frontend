import { Link } from 'react-router-dom';
import styles from './SideCard.module.css';

interface CustomerCardProps {
  customerId: string | null;
  customerName: string | null;
}

export function CustomerCard({ customerId, customerName }: CustomerCardProps) {
  return (
    <section className={styles.card} aria-labelledby="customer-heading">
      <h2 id="customer-heading" className={styles.cardTitle}>Cliente</h2>
      {customerId ? (
        <div className={styles.cardContent}>
          <span className={styles.avatar}>{(customerName ?? 'C').charAt(0).toUpperCase()}</span>
          <div className={styles.info}>
            <span className={styles.name}>{customerName ?? customerId}</span>
            <Link
              to={`/admin/customers/view/${customerId}`}
              className={styles.link}
            >
              Ver perfil →
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Sin cliente asignado</p>
          <button className={styles.ctaBtn} disabled title="Próximamente">
            Vincular cliente
          </button>
        </div>
      )}
    </section>
  );
}
