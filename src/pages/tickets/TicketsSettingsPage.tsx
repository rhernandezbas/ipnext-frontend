import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TicketAreasBody } from './settings/TicketAreasBody';
import { TicketSlaBody } from './settings/TicketSlaBody';
import { TicketStatusesBody } from './settings/TicketStatusesBody';
import styles from './TicketsSettingsPage.module.css';

const TABS = [
  { id: 'areas', label: 'Areas', content: <TicketAreasBody /> },
  { id: 'sla', label: 'SLA / Timer', content: <TicketSlaBody /> }, // #79
  { id: 'statuses', label: 'Estados', content: <TicketStatusesBody /> }, // #8 — moved from standalone route
];

const TAB_IDS = TABS.map(t => t.id);

/**
 * Pagina de configuracion de Tickets. Agrupa en tabs los catalogos del modulo.
 * El tab activo se sincroniza con el hash de la URL (#areas) para deep-linkear.
 */
export default function TicketsSettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'areas';
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
          <span className={styles.breadcrumb}>Tickets /</span>
          <h1 className={styles.title}>Configuracion</h1>
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
