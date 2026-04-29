import { useState } from 'react';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { usePayments, useCreatePayment } from '../../hooks/useBilling';
import { Payment } from '../../types/billing';
import styles from './PagosPage.module.css';

const COLUMNS = [
  { label: 'ID', key: 'id' as keyof Payment },
  { label: 'Cliente', key: 'customerName' as keyof Payment },
  { label: 'Fecha', key: 'date' as keyof Payment },
  {
    label: 'Monto',
    key: 'amount' as keyof Payment,
    render: (row: Payment) => `$${row.amount.toFixed(2)}`,
  },
  { label: 'Método de pago', key: 'method' as keyof Payment },
  {
    label: 'Factura asociada',
    key: 'invoiceId' as keyof Payment,
    render: (row: Payment) => (row.invoiceId != null ? String(row.invoiceId) : '—'),
  },
];

export function PagosPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formError, setFormError] = useState('');

  const createPayment = useCreatePayment();

  const { data, isLoading } = usePayments({
    page,
    limit: 25,
    search: search || undefined,
  });
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Pagos</h1>
      <div className={styles.actionsBar}>
        <button className={styles.actionBtn} onClick={() => setShowNewForm(true)}>
          Registrar pago
        </button>
      </div>
      {showNewForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Registrar pago</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError('');
                const fd = new FormData(e.currentTarget);
                createPayment.mutate(
                  {
                    customerName: fd.get('customerName') as string,
                    amount: Number(fd.get('amount')),
                    date: fd.get('date') as string,
                    method: fd.get('method') as string,
                    reference: fd.get('reference') as string,
                  },
                  {
                    onSuccess: () => setShowNewForm(false),
                    onError: () => setFormError('Error al registrar el pago.'),
                  }
                );
              }}
            >
              <div className={styles.formGroup}>
                <label htmlFor="customerName">Nombre del cliente</label>
                <input id="customerName" name="customerName" required disabled={createPayment.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="amount">Monto</label>
                <input id="amount" name="amount" type="number" required disabled={createPayment.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="date">Fecha</label>
                <input id="date" name="date" type="date" required disabled={createPayment.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="method">Método de pago</label>
                <select id="method" name="method" disabled={createPayment.isPending}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="reference">Referencia</label>
                <input id="reference" name="reference" disabled={createPayment.isPending} />
              </div>
              {formError && <p>{formError}</p>}
              <div className={styles.actionsBar}>
                <button type="submit" disabled={createPayment.isPending}>Registrar pago</button>
                <button type="button" onClick={() => setShowNewForm(false)} disabled={createPayment.isPending}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <FilterBar
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por cliente o número de pago..."
      />
      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No hay pagos."
        totals={{
          id: 'Total',
          customerName: `${data?.data?.length ?? 0} pagos`,
        }}
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
