import { Link } from 'react-router-dom';
import styles from './SideCard.module.css';

interface ServiceDetail {
  plan: string;
  type: string;
}

interface ServiceCardProps {
  serviceId: string | null;
  customerId: string | null;
  service: ServiceDetail | null;
  isLoading?: boolean;
}

export function ServiceCard({ serviceId, customerId, service, isLoading = false }: ServiceCardProps) {
  const renderContent = () => {
    if (!serviceId && !customerId) {
      return <p className={styles.emptyText}>Sin servicio asignado</p>;
    }

    return (
      <div className={styles.cardContent}>
        <div className={styles.info}>
          {isLoading ? (
            <span className={styles.servicePlaceholder}>—</span>
          ) : service ? (
            <>
              <span className={styles.name}>{service.plan}</span>
              <span className={styles.serviceType}>{service.type}</span>
            </>
          ) : (
            <span className={styles.name}>Servicio #{serviceId}</span>
          )}
          {customerId && (
            <Link
              to={`/admin/customers/view/${customerId}#servicios`}
              className={styles.link}
            >
              Ver servicio →
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="service-heading">
      <h2 id="service-heading" className={styles.cardTitle}>Servicio</h2>
      {renderContent()}
    </section>
  );
}
