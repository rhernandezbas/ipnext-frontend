import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { DeviceTypesBody } from './settings/DeviceTypesBody';
import styles from './InventorySettingsPage.module.css';

const TABS = [
  { id: 'equipos', label: 'Equipos', content: <DeviceTypesBody /> },
];

const TAB_IDS = TABS.map(t => t.id);

/**
 * Página de configuración de Inventario. Agrupa en tabs los catálogos del módulo.
 * El tab activo se sincroniza con el hash de la URL (#equipos) para deep-linkear.
 * Montaje lazy: el cuerpo de un tab sólo dispara sus fetches cuando se lo visita.
 */
export default function InventorySettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'equipos';
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
          <span className={styles.breadcrumb}>Inventario /</span>
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
