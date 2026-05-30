import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { GestionRealSyncBody } from './settings/GestionRealSyncBody';
import styles from './CustomersSettingsPage.module.css';

const TABS = [
  { id: 'gr-sync', label: 'Sincronización GR', content: <GestionRealSyncBody /> },
];

const TAB_IDS = TABS.map(t => t.id);

/**
 * Única página de configuración de Clientes. Agrupa en tabs los ajustes propios de
 * la sección. Su primer (y por ahora único) tab aloja la configuración de
 * sincronización de Gestión Real, que antes vivía en Scheduling. El tab activo se
 * sincroniza con el hash de la URL (#gr-sync) para deep-linkear, y el montaje es
 * lazy: el cuerpo de un tab sólo dispara sus fetches al visitarlo por primera vez.
 */
export default function CustomersSettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'gr-sync';
  });

  const mountedIds = useRef<Set<string>>(new Set([activeTab]));

  useEffect(() => {
    mountedIds.current.add(activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (TAB_IDS.includes(hash)) setActiveTab(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Clientes /</span>
          <h1 className={styles.title}>Configuración</h1>
        </div>
      </div>

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mountMode="lazy"
        mountedIds={mountedIds.current}
        size="compact"
      />
    </div>
  );
}
