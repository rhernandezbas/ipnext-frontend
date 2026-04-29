import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useSupplyOrders } from '@/hooks/useEmpresa';
import type { SupplyOrder } from '@/types/empresa';
import styles from './InventoryItemsPage.module.css';

const PAGE_SIZE = 20;

const ESTADO_FILTERS = [
  { key: 'estado', label: 'Estado', options: [
    { value: '', label: 'Todos' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'recibido', label: 'Recibido' },
    { value: 'cancelado', label: 'Cancelado' },
  ] },
];

const COLUMNS = [
  { label: 'Proveedor', key: 'proveedor' as keyof SupplyOrder },
  { label: 'Estado', key: 'estado' as keyof SupplyOrder },
  { label: 'Fecha', key: 'fecha' as keyof SupplyOrder },
  {
    label: 'Total',
    key: 'total' as keyof SupplyOrder,
    render: (row: SupplyOrder) => `$${row.total.toFixed(2)}`,
  },
];

export default function InventorySupplyPage() {
  const { data: orders = [], isLoading } = useSupplyOrders();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = !search || order.proveedor.toLowerCase().includes(search.toLowerCase());
      const matchesEstado = !estado || order.estado === estado;
      return matchesSearch && matchesEstado;
    });
  }, [orders, search, estado]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleFilterChange(_key: string, v: string) {
    setEstado(v);
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Suministro</h1>
      <FilterBar
        onSearch={handleSearch}
        searchPlaceholder="Buscar proveedor..."
        filters={ESTADO_FILTERS}
        onFilterChange={handleFilterChange}
      />
      <DataTable<SupplyOrder>
        columns={COLUMNS}
        data={paginated}
        loading={isLoading}
        emptyMessage="No hay órdenes de suministro que coincidan con los filtros."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
