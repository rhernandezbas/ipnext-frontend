import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useResellers } from '@/hooks/useResellers';
import type { Reseller } from '@/types/reseller';

const COLUMNS = [
  { label: 'Reseller', key: 'name' as keyof Reseller },
  { label: 'Clientes', key: 'clientCount' as keyof Reseller },
  { label: 'Revenue', key: 'revenue' as keyof Reseller, render: (row: Reseller) => `$${row.revenue.toLocaleString('es-AR')}` },
  { label: 'Estado', key: 'status' as keyof Reseller },
];

export default function ResellersListPage() {
  const { data: resellers = [], isLoading } = useResellers();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Resellers</h1>
      <DataTable<Reseller>
        columns={COLUMNS}
        data={resellers}
        loading={isLoading}
        emptyMessage="No hay resellers registrados."
      />
    </div>
  );
}
