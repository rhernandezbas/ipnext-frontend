import { Link } from 'react-router-dom';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import styles from './GigaredNotConfigured.module.css';

/**
 * Shared banner for the 503 GIGARED_NOT_CONFIGURED state. Rendered by the TV
 * accounts page and the customer TV tab whenever the integration is off or the
 * API key is missing. Managers (`tv.manage`) get a deep link to the settings
 * tab; everyone else is told to ask an admin.
 */
export function GigaredNotConfigured() {
  const { can } = useMyPermissions();
  const canManage = can('tv.manage');

  return (
    <div className={styles.banner} role="status">
      <div className={styles.icon} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className={styles.text}>
        <p className={styles.title}>La integración con Gigared TV no está configurada.</p>
        {canManage ? (
          <Link className={styles.action} to="/admin/customers/settings#gigared">
            Configurar integración
          </Link>
        ) : (
          <p className={styles.hint}>Pedile a un administrador que la configure.</p>
        )}
      </div>
    </div>
  );
}
