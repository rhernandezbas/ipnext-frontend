import { useState, useRef, useEffect } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { IClassFlagBody } from './IClassFlagBody';
import { IClassClosureFlagBody } from './IClassClosureFlagBody';
import { IClassSoTypesCatalogBody } from './IClassSoTypesCatalogBody';
import { IClassProjectMappingBody } from './IClassProjectMappingBody';
import { IClassResultCodeMappingBody } from './IClassResultCodeMappingBody';

const SUB_TABS = [
  { id: 'integracion', label: 'Integración',          content: <IClassFlagBody /> },
  { id: 'catalogo',    label: 'Catálogo',             content: <IClassSoTypesCatalogBody /> },
  { id: 'mapeo',       label: 'Mapeo de proyectos',   content: <IClassProjectMappingBody /> },
  { id: 'cierre',      label: 'Cierre de OS',         content: <><IClassClosureFlagBody /><IClassResultCodeMappingBody /></> },
];

/**
 * Sub-tab "IClass" del SchedulingSettingsPage. Agrupa la administración de la
 * integración con IClass en cuatro sub-secciones (sub-tabs internas): Integración
 * (feature flag), Catálogo (SO types), Mapeo de proyectos y Cierre de OS. La de
 * "Cierre de OS" unifica todo el flujo de cierre — flag del loop, reconciliar,
 * reprocess, toggle del auditor IA y el mapeo de resultados — en una sola página.
 * Mount lazy: cada sub-body se monta al primer visit y queda persistido para no
 * perder estado local (row status, summary banner, etc.) al alternar.
 */
export function IClassSettingsBody() {
  const [activeSub, setActiveSub] = useState('integracion');
  const mountedIds = useRef<Set<string>>(new Set([activeSub]));

  useEffect(() => {
    mountedIds.current.add(activeSub);
  }, [activeSub]);

  return (
    <Tabs
      tabs={SUB_TABS}
      activeTab={activeSub}
      onTabChange={setActiveSub}
      mountMode="lazy"
      mountedIds={mountedIds.current}
      size="compact"
    />
  );
}
