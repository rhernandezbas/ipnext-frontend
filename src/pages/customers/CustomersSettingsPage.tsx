import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { GestionRealSyncBody } from './settings/GestionRealSyncBody';
import { ServiceTechnologiesBody } from '../contracts/ServiceTechnologiesBody';
import styles from './CustomersSettingsPage.module.css';

/**
 * Única página de configuración de Clientes. Agrupa en tabs los ajustes propios de
 * la sección. El primer tab aloja la configuración de sincronización de Gestión
 * Real; el segundo (visible sólo con `contracts.read`) el catálogo de Tecnologías
 * de servicio. El tab activo se sincroniza con el hash de la URL (#gr-sync /
 * #tecnologias) para deep-linkear, y el montaje es lazy: el cuerpo de un tab sólo
 * dispara sus fetches al visitarlo por primera vez.
 */
export default function CustomersSettingsPage() {
  const { can } = useMyPermissions();

  const tabs = [
    { id: 'gr-sync', label: 'Sincronización GR', content: <GestionRealSyncBody /> },
    ...(can('contracts.read')
      ? [{ id: 'tecnologias', label: 'Tecnologías', content: <ServiceTechnologiesBody /> }]
      : []),
  ];
  const tabIds = tabs.map((t) => t.id);

  // Keep the latest tab ids available to the (once-registered) hashchange listener.
  const tabIdsRef = useRef(tabIds);
  tabIdsRef.current = tabIds;

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return tabIds.includes(hash) ? hash : 'gr-sync';
  });

  const mountedIds = useRef<Set<string>>(new Set([activeTab]));

  useEffect(() => {
    mountedIds.current.add(activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (tabIdsRef.current.includes(hash)) setActiveTab(hash);
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
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mountMode="lazy"
        mountedIds={mountedIds.current}
        size="compact"
      />
    </div>
  );
}
