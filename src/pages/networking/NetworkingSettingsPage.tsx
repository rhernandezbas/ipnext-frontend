import { Can } from '@/components/auth/Can';
import { UispSyncCard } from '@/components/settings/UispSyncCard';
import { RadiusAccountingCard } from '@/components/settings/RadiusAccountingCard';
import { RadiusAuthIngestCard } from '@/components/settings/RadiusAuthIngestCard';
import { PppoeAutoMoveCard } from '@/components/settings/PppoeAutoMoveCard';
import { UispNodeMappingBody } from '@/components/networking/UispNodeMappingBody';
import { UispNodesList } from '@/components/networking/UispNodesList';
import styles from './NetworkingSettingsPage.module.css';

/**
 * Página de configuración de Gestión de red.
 * Sección UISP: configuración de integración + lista de nodos (espejo).
 * Diseñada para crecer con nuevas secciones de config de red.
 */
export default function NetworkingSettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Gestión de red /</span>
          <h1 className={styles.title}>Configuración</h1>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>UISP</h2>
        <Can permission="uisp.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <UispSyncCard />
        </Can>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>RADIUS</h2>
        <p className={styles.sectionDescription}>
          Configurá la ingesta de eventos del servidor RADIUS (accounting).
        </p>
        <Can permission="admin.flags" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <RadiusAccountingCard />
          <RadiusAuthIngestCard />
        </Can>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>PPPoE</h2>
        <p className={styles.sectionDescription}>
          Automatizaciones sobre las sesiones PPPoE de los NAS.
        </p>
        <Can permission="admin.flags" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <PppoeAutoMoveCard />
        </Can>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Mapeo de nodos</h2>
        <p className={styles.sectionDescription}>
          Vinculá cada network site con su nodo de UISP. El auto-import crea y vincula los nuevos
          automáticamente; acá corregís o vinculás los creados a mano.
        </p>
        <Can permission="uisp.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <UispNodeMappingBody />
        </Can>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Nodos UISP (espejo)</h2>
        <Can permission="uisp.read" fallback={<p className={styles.noPermission}>No tenés permiso para ver esta sección.</p>}>
          <UispNodesList />
        </Can>
      </section>
    </div>
  );
}
