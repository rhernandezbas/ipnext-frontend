import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useInventoryItems } from '@/hooks/useEmpresa';
import type { InventoryItem } from '@/types/empresa';
import styles from './InventoryItemsPage.module.css';

const PAGE_SIZE = 20;

const CATEGORY_FILTERS = [
  { key: 'category', label: 'Categoría', options: [
    { value: '', label: 'Todas' },
    { value: 'router', label: 'Router' },
    { value: 'cable', label: 'Cable' },
    { value: 'splitter', label: 'Splitter' },
    { value: 'onu', label: 'ONU' },
    { value: 'tools', label: 'Herramientas' },
    { value: 'other', label: 'Otro' },
  ] },
];

const COLUMNS = [
  { label: 'Nombre', key: 'name' as keyof InventoryItem },
  { label: 'Categoría', key: 'category' as keyof InventoryItem },
  { label: 'Cantidad', key: 'quantity' as keyof InventoryItem },
  {
    label: 'Precio unitario',
    key: 'unitPrice' as keyof InventoryItem,
    render: (row: InventoryItem) => `$${row.unitPrice.toFixed(2)}`,
  },
  { label: 'Estado', key: 'status' as keyof InventoryItem },
];

export default function InventoryItemsPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !category || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleFilterChange(_key: string, v: string) {
    setCategory(v);
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Artículos de Inventario</h1>
      <FilterBar
        onSearch={handleSearch}
        searchPlaceholder="Buscar artículo..."
        filters={CATEGORY_FILTERS}
        onFilterChange={handleFilterChange}
      />
      <DataTable<InventoryItem>
        columns={COLUMNS}
        data={paginated}
        loading={isLoading}
        emptyMessage="No hay artículos que coincidan con los filtros."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
