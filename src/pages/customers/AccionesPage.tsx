import { useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { useOwnershipCases } from '@/hooks/useActions';
import { OwnershipCasesTab } from './AccionesPage/components/OwnershipCasesTab';
import { RecentBajasTab } from './AccionesPage/components/RecentBajasTab';
import styles from './AccionesPage.module.css';

/**
 * actions-worklist F2 — page "Acciones" (/admin/customers/acciones).
 *
 * Worklist operativo de eventos externos de GR: cambios de titularidad
 * (con checklist AUTO + manual por caso) y bajas recientes (retiro-check).
 * Dos tabs lazy — cada uno dispara su query recién al activarse y queda
 * montado después (mountedIds) para no perder filtros/página al alternar.
 */

const TAB_TITULARIDAD = 'acciones-titularidad';
const TAB_BAJAS = 'acciones-bajas';

export default function AccionesPage() {
  const [activeTab, setActiveTab] = useState(TAB_TITULARIDAD);
  const [mountedIds, setMountedIds] = useState<Set<string>>(() => new Set([TAB_TITULARIDAD]));

  // Contador barato de casos que REQUIEREN acción: pending + ambiguous — dos
  // queries pageSize 1 (solo interesa `total`). Un ambiguous exige un pick del
  // operador, dejarlo fuera del número escondía trabajo real.
  // (El BE persiste el flip a done en la lectura, así que el número no miente.)
  const pendingQuery = useOwnershipCases({ status: 'pending', page: 1, pageSize: 1 });
  const ambiguousQuery = useOwnershipCases({ status: 'ambiguous', page: 1, pageSize: 1 });
  const pendingTotal =
    pendingQuery.data === undefined || ambiguousQuery.data === undefined
      ? undefined
      : pendingQuery.data.total + ambiguousQuery.data.total;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Clientes /</span>
          <h1 className={styles.title}>Acciones</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: TAB_TITULARIDAD,
            label:
              pendingTotal === undefined
                ? 'Cambios de titular'
                : `Cambios de titular (${pendingTotal})`,
            content: <OwnershipCasesTab />,
          },
          {
            id: TAB_BAJAS,
            label: 'Bajas recientes',
            content: <RecentBajasTab />,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id);
          setMountedIds((prev) => new Set(prev).add(id));
        }}
        mountMode="lazy"
        mountedIds={mountedIds}
      />
    </div>
  );
}
