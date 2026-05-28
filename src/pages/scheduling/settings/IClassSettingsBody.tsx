import { useState, useRef, useEffect } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { IClassFlagBody } from './IClassFlagBody';
import { IClassSoTypesCatalogBody } from './IClassSoTypesCatalogBody';
import { IClassProjectMappingBody } from './IClassProjectMappingBody';

const SUB_TABS = [
  { id: 'integracion', label: 'Integración',         content: <IClassFlagBody /> },
  { id: 'catalogo',    label: 'Catálogo',            content: <IClassSoTypesCatalogBody /> },
  { id: 'mapeo',       label: 'Mapeo de proyectos',  content: <IClassProjectMappingBody /> },
];

/**
 * Sub-tab "IClass" del SchedulingSettingsPage. Agrupa la administración de la
 * integración con IClass en tres sub-secciones (sub-tabs internas): Integración
 * (feature flag), Catálogo (SO types) y Mapeo de proyectos. Mount lazy: cada
 * sub-body se monta al primer visit y queda persistido para no perder estado
 * local (row status, summary banner, etc.) al alternar.
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
