import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TechnologyCostsBody } from './settings/TechnologyCostsBody';
import { PlanPricesBody } from './settings/PlanPricesBody';
import { TargetsBody } from './settings/TargetsBody';
import { InflationBody } from './settings/InflationBody';
import { InvoiceTypesBody } from './settings/InvoiceTypesBody';
import styles from './FinanceGrowthSettingsPage.module.css';

const TABS = [
  { id: 'technology-costs', label: 'Costos por tecnología', content: <TechnologyCostsBody /> },
  { id: 'plan-prices', label: 'Precios por plan', content: <PlanPricesBody /> },
  { id: 'targets', label: 'Metas', content: <TargetsBody /> },
  { id: 'inflation', label: 'IPC', content: <InflationBody /> },
  { id: 'invoice-types', label: 'Tipos de comprobante', content: <InvoiceTypesBody /> },
];

const TAB_IDS = TABS.map((t) => t.id);

/**
 * Settings de Crecimiento Financiero (Fase 5, items 5.9-5.13): 5 sub-secciones
 * en tabs, mismo molde que TicketsSettingsPage — UNA sola ruta, hash-sync para
 * deep-link, montaje lazy (cada body sólo fetchea cuando se visita su tab).
 */
export default function FinanceGrowthSettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'technology-costs';
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
        <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
        <h1 className={styles.title}>Configuración</h1>
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
