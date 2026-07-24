import { Link } from 'react-router-dom';
import { Can } from '@/components/auth/Can';
import { NocAlertsHubEnabledCard } from '@/components/settings/NocAlertsHubEnabledCard';
import { NocAlertsTelegramSendCard } from '@/components/settings/NocAlertsTelegramSendCard';
import { NocAlertThresholdsEditor } from '@/components/settings/NocAlertThresholdsEditor';
import { ActivityBody } from '@/pages/system/admin/ActivityBody';
import styles from './AlertsConfigPage.module.css';

/**
 * Configuración del hub de alertas NOC (change `noc-alerts-config`, Fase F FE).
 * Molde: `NetworkingSettingsPage` (secciones con heading + `Can .. fallback=`
 * por sección, cada una con su propio gate real).
 *
 * Secciones:
 *  1. Feature flags — `noc-alerts-hub-enabled` (kill-switch raíz) +
 *     `noc-alerts-telegram-send` (reenvío a Telegram). Gate `admin.flags`.
 *  2. Umbrales — los 5 campos de `alerts/thresholds`. El editor se autogatea
 *     `monitoring.manage` (el BE exige ese permiso incluso para el GET, no
 *     hay lectura con solo `monitoring.read` — ver el comentario en
 *     `NocAlertThresholdsEditor.tsx`), por eso NO se envuelve en un `Can`
 *     extra acá (evitaría un mensaje de "sin permiso" duplicado).
 *  3. Auditoría de alertas — reusa `ActivityBody` (Actividad de
 *     `AdminPage`) preseedeada con `entityType=NocAlert` para ver quién
 *     ackeó qué alerta, por qué canal (panel/telegram) y cuándo. Gate
 *     `admin.view_activity_log` (el mismo que protege el endpoint en el BE,
 *     `auditEvents.routes.ts`).
 */
export default function AlertsConfigPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/admin/alerts" className={styles.breadcrumb}>
            Alertas NOC /
          </Link>
          <h1 className={styles.title}>Configuración</h1>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Feature flags</h2>
        <p className={styles.sectionDescription}>
          Kill-switches del hub: qué persiste/se ve en el panel, y si además se reenvía a Telegram.
        </p>
        <Can
          permission="admin.flags"
          fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}
        >
          <NocAlertsHubEnabledCard />
          <NocAlertsTelegramSendCard />
        </Can>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Umbrales</h2>
        <p className={styles.sectionDescription}>
          Cuándo el hub dispara warning/crítico por señal óptica y cuándo sospecha de un problema
          compartido en un PON.
        </p>
        <NocAlertThresholdsEditor />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Auditoría de alertas</h2>
        <p className={styles.sectionDescription}>
          Quién reconoció (ACK) cada alerta, por qué canal (panel o Telegram) y cuándo.
        </p>
        <Can
          permission="admin.view_activity_log"
          fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}
        >
          <ActivityBody initialEntityType="NocAlert" />
        </Can>
      </section>
    </div>
  );
}
