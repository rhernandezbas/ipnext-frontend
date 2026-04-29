import type { Customer } from '../../../types/customer';
import styles from './Tab.module.css';

interface Props { customer: Customer; active: boolean; }

export function InformacionTab({ customer }: Props) {
  const fields = [
    { label: 'Nombre', value: customer.name },
    { label: 'Email', value: customer.email },
    { label: 'Teléfono', value: customer.phone },
    { label: 'Dirección', value: customer.address },
    { label: 'Categoría', value: customer.category },
    { label: 'Plan de tarifa', value: customer.tariffPlan },
    { label: 'Saldo', value: customer.balance != null ? `$${customer.balance.toFixed(2)}` : null },
    { label: 'Fecha de alta', value: customer.createdAt },
  ];

  return (
    <div className={styles.tab}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos personales</h2>
        <dl className={styles.fieldList}>
          {fields.map(({ label, value }) => (
            <div key={label} className={styles.field}>
              <dt className={styles.fieldLabel}>{label}</dt>
              <dd className={styles.fieldValue}>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.mapWidget}>
        <h3>Ubicación</h3>
        <iframe
          title="Mapa de ubicación"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-65%2C-35%2C-57%2C-30&layer=mapnik&marker=-32%2C-61"
        />
      </div>
    </div>
  );
}
