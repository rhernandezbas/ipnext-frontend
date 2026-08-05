import { Link } from 'react-router-dom';
import { useClientPortalSettings } from '@/hooks/useSettings';
import type { ClientPortalSettings } from '@/types/settings';
import styles from './PortalConfigPage.module.css';

/** Filas booleanas que se muestran como Habilitado / Deshabilitado. */
const FEATURE_ROWS: { field: keyof ClientPortalSettings; label: string }[] = [
  { field: 'allowPaymentOnline', label: 'Pagos online' },
  { field: 'allowTicketCreation', label: 'Crear tickets' },
  { field: 'allowServiceManagement', label: 'Gestionar servicios' },
  { field: 'allowSelfRegistration', label: 'Auto-registro' },
  { field: 'requireEmailVerification', label: 'Verificación de email' },
];

function Flag({ on }: { on: boolean }) {
  return (
    <span className={[styles.flag, on ? styles.flagOn : styles.flagOff].join(' ')}>
      {on ? 'Habilitado' : 'Deshabilitado'}
    </span>
  );
}

/**
 * PortalConfigPage (gestion-app) — vista de SÓLO LECTURA de la configuración
 * REAL del portal (`GET /api/settings/client-portal`). La EDICIÓN vive en
 * Sistema › Configuración (fuente de verdad única, `PortalClienteTab`): no la
 * duplicamos acá para no tener dos formularios peleando por el mismo singleton.
 *
 * Antes esta página servía un mock hardcodeado que mentía frente al endpoint
 * real que ya está en prod — exactamente la inconsistencia que había que matar.
 *
 * 3 ramas: loading (skeleton) / error (alerta + reintento) / success. NO hay
 * rama "empty": "desactivada" es un estado legítimo, no un vacío.
 */
export default function PortalConfigPage() {
  const { data: config, isLoading, isError, refetch } = useClientPortalSettings();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuración de la app</h1>
        <p className={styles.subtitle}>
          Qué puede hacer el cliente desde la app. Para editar estos valores, andá a{' '}
          <Link className={styles.link} to="/admin/config/main">
            Sistema › Configuración
          </Link>
          .
        </p>
      </header>

      {isLoading ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : isError ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudo cargar la configuración. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : config ? (
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado del portal</span>
            <span className={[styles.flag, config.enabled ? styles.flagOn : styles.flagOff].join(' ')}>
              {config.enabled ? 'Activada' : 'Desactivada'}
            </span>
          </div>

          {config.portalUrl && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>URL del portal</span>
              <a className={styles.link} href={config.portalUrl} target="_blank" rel="noreferrer">
                {config.portalUrl}
              </a>
            </div>
          )}

          <h2 className={styles.sectionTitle}>Funcionalidades</h2>
          {FEATURE_ROWS.map(({ field, label }) => (
            <div key={field} className={styles.row}>
              <span className={styles.rowLabel}>{label}</span>
              <Flag on={Boolean(config[field])} />
            </div>
          ))}

          <h2 className={styles.sectionTitle}>Mensaje de bienvenida</h2>
          <p className={styles.welcome}>{config.welcomeMessage || 'Sin mensaje configurado.'}</p>
        </div>
      ) : null}
    </div>
  );
}
