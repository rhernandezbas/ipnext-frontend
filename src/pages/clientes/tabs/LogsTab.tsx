import { useState } from 'react';
import { DataTable } from '../../../components/organisms/DataTable/DataTable';
import { Pagination } from '../../../components/molecules/Pagination/Pagination';
import { useClientLogs } from '../../../hooks/useClients';
import type { LogEntry } from '../../../types/customer';
import styles from './Tab.module.css';

const COLUMNS = [
  { label: 'Fecha', key: 'date' as keyof LogEntry },
  { label: 'Tipo de evento', key: 'type' as keyof LogEntry },
  { label: 'Mensaje', key: 'message' as keyof LogEntry },
];

interface Props { clientId: string; active: boolean; }

export function LogsTab({ clientId, active }: Props) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useClientLogs(clientId, page, active);
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className={styles.tab}>
      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="Sin eventos de log."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
