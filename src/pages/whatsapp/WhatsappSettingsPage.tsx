import { Can } from '@/components/auth/Can';
import { ChatMediaDownloadCard } from '@/components/settings/ChatMediaDownloadCard';
import { ChatwootSendPathCard } from '@/components/settings/ChatwootSendPathCard';
import { ChatwootLabelsCard } from '@/components/settings/ChatwootLabelsCard';
import { NocBroadcastCard } from '@/components/settings/NocBroadcastCard';
import { TaskStageConfigCard } from '@/components/settings/TaskStageConfigCard';
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

      {/* chatwoot-hub-sendpath (eje central) — flag `messaging-send-via-chatwoot`.
          Mismo gate que la sección Media (`messaging.read` para ver, `admin.flags`
          adentro de la card para el toggle): es la card hermana más cercana de
          esta misma página. */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Envío</h2>
        <p className={styles.sectionDescription}>
          Camino de salida de los templates (hilo y envíos masivos): directo por Twilio, o vía
          Chatwoot para que quede registrado en la conversación.
        </p>
        <Can permission="messaging.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <ChatwootSendPathCard />
        </Can>
      </section>

      {/* chatwoot-label-config-fe — catálogo de etiquetas de Chatwoot (D1/D5
          del design de campaign-chatwoot-label). Antes se creaban desde un CTA
          dentro del composer del bulk (`ChatwootLabelSelector`); pedido
          textual del usuario ("el crear label tiene que estar en
          configuración") las mudó acá. Gate `messaging.templates`: MISMO
          permiso que ya gatea el catálogo del picker del composer
          (`CampaignComposer.canUseTemplates`) — la card entera queda
          consistente con "quién puede VER el catálogo de labels de Chatwoot"
          en todo el repo. El CTA "Crear etiqueta…" de adentro tiene su PROPIO
          gate (`messaging.manage`, tier supervisor). */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Etiquetas de Chatwoot</h2>
        <p className={styles.sectionDescription}>
          Etiquetas de Chatwoot para clasificar campañas de envío masivo (universo distinto de las etiquetas de
          conversación de la sección &quot;Etiquetas&quot;, que son locales del inbox).
        </p>
        <Can permission="messaging.templates" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <ChatwootLabelsCard />
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

      {/* N1-FE — Difusión NOC (Evolution API en el Pi): conexión editable desde
          UI (guardada en DB) que manda noticias/tareas de red al canal "noc
          lider". Gate `messaging.manage` (equivalente FE del `messaging:manage`
          del BE, que gatea el PUT/POST): SIN el permiso, ni la sección ni su
          encabezado se renderizan (mismo criterio, sin fallback, que respuestas
          rápidas). */}
      <Can permission="messaging.manage">
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Difusión NOC</h2>
          <p className={styles.sectionDescription}>
            Conexión con el WhatsApp dedicado (Evolution API en un Pi) que difunde noticias y tareas
            de red al canal del NOC líder. Se configura y prueba desde acá; la config vive en la base
            de datos.
          </p>
          <NocBroadcastCard />
        </section>
      </Can>

      {/* bulk-task-recipients (D8, Parte A) — mapeo Stage→elegible-como-
          destinatario del criterio "Tarea" del bulk WhatsApp. Card visible
          con `messaging.read` (la LEE también el tab "Tarea" del composer);
          el PUT adentro está gateado a `messaging.manage` (mismo par
          "supervisor" que noc-broadcast/canned-responses). */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Destinatarios por estado de tarea</h2>
        <p className={styles.sectionDescription}>
          Elegí qué estados de tarea (agrupados por workflow de Scheduling) hacen que un cliente sea destinatario
          del criterio &quot;Tarea&quot; al armar un envío masivo.
        </p>
        <Can permission="messaging.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <TaskStageConfigCard />
        </Can>
      </section>
    </div>
  );
}
