import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useCdrRecords } from '@/hooks/useCdr';
import type { CdrRecord } from '@/types/cdr';

const COLUMNS = [
  { label: 'Fecha', key: 'date' as keyof CdrRecord },
  { label: 'Origen', key: 'origin' as keyof CdrRecord },
  { label: 'Destino', key: 'destination' as keyof CdrRecord },
  { label: 'Duración', key: 'duration' as keyof CdrRecord, render: (row: CdrRecord) => `${row.duration}s` },
  { label: 'Tarifa', key: 'rate' as keyof CdrRecord, render: (row: CdrRecord) => `$${row.rate}` },
  { label: 'Costo', key: 'cost' as keyof CdrRecord, render: (row: CdrRecord) => `$${row.cost}` },
  { label: 'Estado', key: 'status' as keyof CdrRecord },
];

export default function CDRPage() {
  const { data: records = [], isLoading } = useCdrRecords();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">CDR — Registros de Llamadas</h1>
      <DataTable<CdrRecord>
        columns={COLUMNS}
        data={records}
        loading={isLoading}
        emptyMessage="No hay registros CDR."
      />
    </div>
  );
}
