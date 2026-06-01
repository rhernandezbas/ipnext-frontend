import { useState } from 'react';
import { useClientDetail, useClientContracts } from '@/hooks/useCustomers';

type SchedulingAssignee = { id: string; name: string };
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { CustomerCard } from './CustomerCard';
import { ContractCard } from './ContractCard';
import { ReporterCard } from './ReporterCard';
import { WatchersChips } from './WatchersChips';
import { ComingSoonPanel } from './ComingSoonPanel';
import styles from './CustomerSidebar.module.css';

export interface CustomerSidebarProps {
  customerId: string | null;
  customerName: string | null;
  contractId: string | null;
  reporterId: string | null;
  watcherIds: string[];
  admins: SchedulingAssignee[];
  onWatchersChange: (ids: string[]) => void;
  isSavingWatchers: boolean;
}

export function CustomerSidebar({
  customerId,
  customerName,
  contractId,
  reporterId,
  watcherIds,
  admins,
  onWatchersChange,
  isSavingWatchers,
}: CustomerSidebarProps) {
  const [activeTab, setActiveTab] = useState('detalles');

  // Gate hooks on customerId
  const { data: clientDetail, isLoading: isLoadingContact } = useClientDetail(customerId ?? '');
  const { data: clientContracts = [] } = useClientContracts(customerId ?? '', !!customerId);

  // Resolve the contract object matching the task's contractId (task contractId is string, Contract.id is number)
  const resolvedContract = contractId
    ? (clientContracts.find((s) => String(s.id) === contractId) ?? null)
    : null;

  // Map to { plan, type, address, technology } that ContractCard expects
  const contractDetail = resolvedContract
    ? { plan: resolvedContract.plan, type: resolvedContract.type, address: resolvedContract.address ?? null, technology: resolvedContract.technology ?? null }
    : null;

  const tabs = [
    {
      id: 'detalles',
      label: 'Detalles',
      content: (
        <div className={styles.detallesStack}>
          <CustomerCard
            customerId={customerId}
            customerName={customerName}
            email={clientDetail?.email}
            phone={clientDetail?.phone}
            customerCity={clientDetail?.city}
            isLoadingContact={isLoadingContact}
          />
          <ContractCard
            contractId={contractId}
            customerId={customerId}
            contract={contractDetail}
            isLoading={isLoadingContact}
          />
          <ReporterCard reporterId={reporterId} allAdmins={admins} />
          <WatchersChips
            watcherIds={watcherIds}
            allAdmins={admins}
            onChange={onWatchersChange}
            isSaving={isSavingWatchers}
          />
        </div>
      ),
    },
    {
      id: 'inventario',
      label: 'Inventario',
      content: (
        <ComingSoonPanel
          title="Inventario del cliente"
          description="Equipos y materiales asignados. Próximamente."
        />
      ),
    },
    {
      id: 'documentos',
      label: 'Documentos',
      content: (
        <ComingSoonPanel
          title="Documentos del cliente"
          description="Documentación y archivos del cliente. Próximamente."
        />
      ),
    },
  ];

  return (
    <aside className={styles.sidebar}>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mountMode="all"
      />
    </aside>
  );
}
