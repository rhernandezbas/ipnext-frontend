import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useDunningEntries } from '@/hooks/useDunning';
import type { DunningEntry } from '@/types/dunning';

const COLUMNS = [
  { label: 'Cliente', key: 'clientName' as keyof DunningEntry },
  { label: 'Monto', key: 'amount' as keyof DunningEntry, render: (row: DunningEntry) => `$${row.amount.toLocaleString('es-AR')}` },
  { label: 'Vencimiento', key: 'dueDate' as keyof DunningEntry },
  { label: 'Etapa', key: 'stage' as keyof DunningEntry },
  { label: 'Estado', key: 'status' as keyof DunningEntry },
];

export default function DunningPage() {
  const { data: entries = [], isLoading } = useDunningEntries();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dunning</h1>
      <DataTable<DunningEntry>
        columns={COLUMNS}
        data={entries}
        loading={isLoading}
        emptyMessage="No hay entradas de dunning."
      />
    </div>
  );
}
