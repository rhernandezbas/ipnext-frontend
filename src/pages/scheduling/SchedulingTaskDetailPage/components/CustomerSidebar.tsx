import { useState } from 'react';
import { useClientDetail, useClientServices } from '@/hooks/useCustomers';

type SchedulingAssignee = { id: string; name: string };
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { CustomerCard } from './CustomerCard';
import { ServiceCard } from './ServiceCard';
import { ReporterCard } from './ReporterCard';
import { WatchersChips } from './WatchersChips';
import { ComingSoonPanel } from './ComingSoonPanel';
import styles from './CustomerSidebar.module.css';

export interface CustomerSidebarProps {
  customerId: string | null;
  customerName: string | null;
  serviceId: string | null;
  reporterId: string | null;
  watcherIds: string[];
  admins: SchedulingAssignee[];
  onWatchersChange: (ids: string[]) => void;
  isSavingWatchers: boolean;
}

export function CustomerSidebar({
  customerId,
  customerName,
  serviceId,
  reporterId,
  watcherIds,
  admins,
  onWatchersChange,
  isSavingWatchers,
}: CustomerSidebarProps) {
  const [activeTab, setActiveTab] = useState('detalles');

  // Gate hooks on customerId
  const { data: clientDetail, isLoading: isLoadingContact } = useClientDetail(customerId ?? '');
  const { data: clientServices = [] } = useClientServices(customerId ?? '', !!customerId);

  // Resolve the service object matching the task's serviceId (task serviceId is string, Service.id is number)
  const resolvedService = serviceId
    ? (clientServices.find((s) => String(s.id) === serviceId) ?? null)
    : null;

  // Map to { plan, type } that ServiceCard expects
  const serviceDetail = resolvedService
    ? { plan: resolvedService.plan, type: resolvedService.type }
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
          <ServiceCard
            serviceId={serviceId}
            customerId={customerId}
            service={serviceDetail}
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
