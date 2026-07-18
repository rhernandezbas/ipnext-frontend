import { Can } from '@/components/auth/Can';
import { ChatMediaDownloadCard } from '@/components/settings/ChatMediaDownloadCard';
import { CannedResponsesSection } from '@/components/settings/cannedResponses/CannedResponsesSection';
import { MessagingLabelsBody } from './settings/MessagingLabelsBody';
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

      {/* Ola 4 (respuestas rápidas / macros) — gestión ABM, gateada por
          `messaging.manage`: SIN el permiso, ni la sección ni su encabezado se
          renderizan (sin fallback). `messaging.manage` es el equivalente FE
          (convención de puntos del repo: `messaging.read`/`.send`/`.bulk`) del
          gate BE `messaging:manage`. */}
      <Can permission="messaging.manage">
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Respuestas rápidas</h2>
          <p className={styles.sectionDescription}>
            Mensajes prearmados (macros) que los agentes insertan en el composer del inbox tipeando “/” o
            con el botón dedicado. El atajo es lo que buscan; el contenido es lo que se inserta.
          </p>
          <CannedResponsesSection />
        </section>
      </Can>

      {/* Ola 5 (labels) — catálogo de etiquetas de conversación. Solo
          `messaging.manage` (el ABM del catálogo); un usuario con solo
          `messaging.read` no ve esta sección. */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Etiquetas</h2>
        <p className={styles.sectionDescription}>
          Etiquetas de color para clasificar conversaciones. Se asignan desde el hilo y se pueden filtrar en la bandeja.
        </p>
        <Can permission="messaging.manage" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <MessagingLabelsBody />
        </Can>
      </section>
    </div>
  );
}
