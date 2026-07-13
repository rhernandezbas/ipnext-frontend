import { Can } from '@/components/auth/Can';
import { ChatMediaDownloadCard } from '@/components/settings/ChatMediaDownloadCard';
import styles from './WhatsappSettingsPage.module.css';

/**
 * Página de configuración de WhatsApp (F1.5 polish). Primera settings page
 * del dominio messaging — sigue el patrón simple (sin tabs) de
 * NetworkingSettingsPage: header + secciones gateadas con <Can>, cada una
 * con la card de flag correspondiente. Arranca con una sola sección
 * (descarga de media); crece agregando secciones a medida que aparezcan
 * más flags de messaging.
 */
export default function WhatsappSettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>WhatsApp /</span>
          <h1 className={styles.title}>Configuración</h1>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Media</h2>
        <p className={styles.sectionDescription}>
          Automatizaciones sobre los adjuntos (fotos, videos, audios, archivos) que llegan por WhatsApp.
        </p>
        <Can permission="messaging.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <ChatMediaDownloadCard />
        </Can>
      </section>
    </div>
  );
}
