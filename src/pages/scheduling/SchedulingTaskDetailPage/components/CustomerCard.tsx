import { Link } from 'react-router-dom';
import styles from './SideCard.module.css';

interface CustomerCardProps {
  customerId: string | null;
  customerName: string | null;
  email?: string | null;
  phone?: string | null;
  customerCity?: string | null;
  isLoadingContact?: boolean;
}

function ContactRow({
  label,
  isLoading,
  value,
  href,
}: {
  label: string;
  isLoading: boolean;
  value: string | null | undefined;
  href?: string;
}) {
  const displayValue = isLoading
    ? '—'
    : (value ?? 'Sin dato');

  return (
    <div className={styles.contactRow}>
      <span className={styles.contactLabel}>{label}</span>
      {isLoading || !value ? (
        <span className={isLoading ? styles.contactPlaceholder : styles.contactValue}>
          {displayValue}
        </span>
      ) : (
        <a href={href} className={styles.contactLink}>
          {value}
        </a>
      )}
    </div>
  );
}

export function CustomerCard({
  customerId,
  customerName,
  email,
  phone,
  customerCity,
  isLoadingContact = false,
}: CustomerCardProps) {
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

      {customerId && (
        <div className={styles.contactRows}>
          <ContactRow
            label="Email"
            isLoading={isLoadingContact}
            value={email}
            href={email ? `mailto:${email}` : undefined}
          />
          <ContactRow
            label="Teléfono"
            isLoading={isLoadingContact}
            value={phone}
            href={phone ? `tel:${phone}` : undefined}
          />
          <ContactRow
            label="Ciudad"
            isLoading={isLoadingContact}
            value={customerCity}
          />
        </div>
      )}
    </section>
  );
}
