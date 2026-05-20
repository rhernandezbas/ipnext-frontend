import { Link } from 'react-router-dom';
import styles from './SideCard.module.css';

interface ServiceCardProps {
  serviceId: string | null;
  customerId: string | null;
}

export function ServiceCard({ serviceId, customerId }: ServiceCardProps) {
  return (
    <section className={styles.card} aria-labelledby="service-heading">
      <h2 id="service-heading" className={styles.cardTitle}>Servicio</h2>
      {serviceId && customerId ? (
        <div className={styles.cardContent}>
          <div className={styles.info}>
            <span className={styles.name}>{serviceId}</span>
            <Link
              to={`/admin/customers/view/${customerId}#servicios`}
              className={styles.link}
            >
              Ver servicio →
            </Link>
          </div>
        </div>
      ) : (
        <p className={styles.emptyText}>Sin servicio asignado</p>
      )}
    </section>
  );
}
