import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TaskCategoriesBody } from './settings/TaskCategoriesBody';
import { TaskPrioritiesBody } from './settings/TaskPrioritiesBody';
import { StageColorsBody } from './settings/StageColorsBody';
import { TaskTemplatesBody } from './settings/TaskTemplatesBody';
import { IClassSettingsBody } from './settings/IClassSettingsBody';
import styles from './SchedulingTaskCategoriesPage.module.css';

const TABS = [
  { id: 'categorias',  label: 'Categorías',         content: <TaskCategoriesBody /> },
  { id: 'prioridades', label: 'Prioridades',        content: <TaskPrioritiesBody /> },
  { id: 'colores',     label: 'Colores de estados', content: <StageColorsBody /> },
  { id: 'plantillas',  label: 'Plantillas',         content: <TaskTemplatesBody /> },
  { id: 'iclass',      label: 'IClass',             content: <IClassSettingsBody /> },
];

const TAB_IDS = TABS.map(t => t.id);

/**
 * Única página de configuración de Scheduling. Agrupa en tabs los catálogos que
 * antes vivían como rutas sueltas (categorías, prioridades, colores de estados,
 * plantillas). Cada tab reusa el *Body extraído de su página original — las rutas
 * standalone siguen existiendo. El tab activo se sincroniza con el hash de la URL
 * (#plantillas) para poder deep-linkear, y el montaje es lazy: el cuerpo de un tab
 * sólo dispara sus fetches cuando se lo visita por primera vez.
 */
export default function SchedulingSettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'categorias';
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
          <span className={styles.breadcrumb}>Scheduling /</span>
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
