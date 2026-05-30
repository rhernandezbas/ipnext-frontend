import { ServiceTechnologiesBody } from './ServiceTechnologiesBody';
import styles from './ServiceTechnologiesPage.module.css';

export default function ServiceTechnologiesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Contratos /</span>
          <h1 className={styles.title}>Tecnologías de servicio</h1>
        </div>
      </div>
      <ServiceTechnologiesBody />
    </div>
  );
}
