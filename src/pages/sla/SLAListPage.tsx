import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useSlaContracts } from '@/hooks/useSla';
import type { SlaContract } from '@/types/sla';

const COLUMNS = [
  { label: 'Cliente', key: 'clientName' as keyof SlaContract },
  { label: 'Nivel', key: 'level' as keyof SlaContract },
  { label: 'Uptime comprometido', key: 'committedUptime' as keyof SlaContract, render: (row: SlaContract) => `${row.committedUptime}%` },
  { label: 'Uptime real', key: 'actualUptime' as keyof SlaContract, render: (row: SlaContract) => `${row.actualUptime}%` },
  { label: 'Estado', key: 'status' as keyof SlaContract },
];

export default function SLAListPage() {
  const { data: contracts = [], isLoading } = useSlaContracts();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Contratos SLA</h1>
      <DataTable<SlaContract>
        columns={COLUMNS}
        data={contracts}
        loading={isLoading}
        emptyMessage="No hay contratos SLA registrados."
      />
    </div>
  );
}
