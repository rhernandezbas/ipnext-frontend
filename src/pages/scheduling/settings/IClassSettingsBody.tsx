import { useState, useRef, useEffect } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { IClassFlagBody } from './IClassFlagBody';
import { IClassClosureFlagBody } from './IClassClosureFlagBody';
import { IClassSoTypesCatalogBody } from './IClassSoTypesCatalogBody';
import { IClassProjectMappingBody } from './IClassProjectMappingBody';
import { IClassResultCodeMappingBody } from './IClassResultCodeMappingBody';
import { ClosureProgressTable } from './ClosureProgressTable';
import { ClosureIntervalConfig } from './ClosureIntervalConfig';

const SUB_TABS = [
  { id: 'integracion',   label: 'Integración',        content: <IClassFlagBody /> },
  { id: 'catalogo',      label: 'Catálogo',           content: <IClassSoTypesCatalogBody /> },
  { id: 'mapeo',         label: 'Mapeo de proyectos', content: <IClassProjectMappingBody /> },
  { id: 'mapeo-estado',  label: 'Mapeo de estado',    content: <IClassResultCodeMappingBody /> },
  {
    id: 'cierre',
    label: 'Procesamiento',
    content: (
      <>
        <IClassClosureFlagBody />
        <ClosureIntervalConfig />
        <ClosureProgressTable />
      </>
    ),
  },
];

/**
 * Sub-tab "IClass" del SchedulingSettingsPage. Agrupa la administración de la
 * integración con IClass en cinco sub-secciones (sub-tabs internas):
 * - Integración: feature flag del loop de cierre
 * - Catálogo: tipos de OS
 * - Mapeo de proyectos: proyecto ↔ IClass
 * - Mapeo de estado: mapeo de resultados (IClassResultCodeMappingBody)
 * - Procesamiento: flag del loop + tabla de side-effects pendientes (ClosureProgressTable)
 *
 * El id `cierre` se preserva para compatibilidad con deep-links existentes.
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
