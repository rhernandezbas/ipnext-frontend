import { Link } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useStoreOrders } from '@/hooks/useStore';
import { formatMoney } from '@/utils/formatMoney';
import { toDecimalNumber } from '@/utils/decimal';
import { formatDateShort } from '@/utils/formatDate';
import type { StoreOrderDto } from '@/types/store';
import styles from './ProductsTab.module.css';

/**
 * OrdersTab (store-admin) — pedidos de la tienda de la app, READ-ONLY (sin
 * acciones, sin gate `store.manage` — leer pedidos es parte de `store.read`,
 * mismo criterio que el resto de esta página).
 *
 * El link al reclamo usa `ticketId` (UUID real) y muestra `ticketNumber`
 * ("#N") — RESUELTO: el DTO real del BE (`storeOrders.dto.ts`) manda AMBOS
 * campos, justamente porque la ruta `/admin/tickets/:id` resuelve por
 * `getById(id)` y NO acepta `sequenceNumber`. El riesgo de 404 que este
 * comentario documentaba en la primera versión quedó cerrado del lado del
 * backend antes del merge.
 */
export function OrdersTab() {
  const { data, isLoading, isError, refetch } = useStoreOrders();
  const orders = data ?? [];
  const showEmpty = !isLoading && !isError && orders.length === 0;

  const columns = [
    { label: 'Producto', key: 'product', render: (row: StoreOrderDto) => row.product.title },
    { label: 'Cliente', key: 'client', render: (row: StoreOrderDto) => row.client.name },
    { label: 'Contrato', key: 'contractId' },
    { label: 'Cuotas', key: 'installments', render: (row: StoreOrderDto) => `${row.installments}` },
    {
      label: 'Precio',
      key: 'priceArsAtOrder',
      render: (row: StoreOrderDto) => formatMoney(toDecimalNumber(row.priceArsAtOrder), 'ARS'),
    },
    {
      label: 'Reclamo',
      key: 'ticketNumber',
      render: (row: StoreOrderDto) =>
        row.ticketId != null ? (
          <Link to={`/admin/tickets/${row.ticketId}`}>#{row.ticketNumber ?? '…'}</Link>
        ) : (
          '—'
        ),
    },
    {
      label: 'Fecha',
      key: 'createdAt',
      render: (row: StoreOrderDto) => formatDateShort(row.createdAt),
    },
  ];

  return (
    <div className={styles.tab}>
      {isError ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar los pedidos. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Todavía no hay pedidos.</p>
          <p className={styles.emptyText}>Los pedidos que hagan los clientes desde la tienda de la app van a aparecer acá.</p>
        </div>
      ) : (
        <DataTable<StoreOrderDto> columns={columns} data={orders} loading={isLoading} emptyMessage="Todavía no hay pedidos." />
      )}
    </div>
  );
}
