import { useState } from 'react';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { useTransactions } from '../../hooks/useBilling';
import { Transaction } from '../../types/billing';
import styles from './TransaccionesPage.module.css';

const TIPO_LABELS: Record<Transaction['type'], string> = {
  credit: 'Crédito',
  debit: 'Cargo',
};

const COLUMNS = [
  { label: 'ID', key: 'id' as keyof Transaction },
  { label: 'Cliente', key: 'customerName' as keyof Transaction },
  {
    label: 'Tipo',
    key: 'type' as keyof Transaction,
    render: (row: Transaction) => TIPO_LABELS[row.type],
  },
  {
    label: 'Monto',
    key: 'amount' as keyof Transaction,
    render: (row: Transaction) => `$${row.amount.toFixed(2)}`,
  },
  { label: 'Fecha', key: 'date' as keyof Transaction },
  { label: 'Descripción', key: 'description' as keyof Transaction },
];

export function TransaccionesPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTransactions({
    page,
    limit: 25,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Transacciones</h1>
      <div className={styles.dateFilters}>
        <label className={styles.label}>Desde</label>
        <input
          type="date"
          className={styles.dateInput}
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <label className={styles.label}>Hasta</label>
        <input
          type="date"
          className={styles.dateInput}
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No hay transacciones."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
