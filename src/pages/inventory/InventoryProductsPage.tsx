import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useInventoryProducts } from '@/hooks/useEmpresa';
import type { InventoryProduct } from '@/types/empresa';
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
  { label: 'Nombre', key: 'name' as keyof InventoryProduct },
  { label: 'Categoría', key: 'category' as keyof InventoryProduct },
  { label: 'SKU', key: 'sku' as keyof InventoryProduct },
  {
    label: 'Precio unitario',
    key: 'unitPrice' as keyof InventoryProduct,
    render: (row: InventoryProduct) => `$${row.unitPrice.toFixed(2)}`,
  },
  { label: 'Stock total', key: 'totalStock' as keyof InventoryProduct },
  { label: 'Estado', key: 'status' as keyof InventoryProduct },
];

export default function InventoryProductsPage() {
  const { data: products = [], isLoading } = useInventoryProducts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !search || product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !category || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

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
      <h1 className={styles.title}>Productos</h1>
      <FilterBar
        onSearch={handleSearch}
        searchPlaceholder="Buscar producto..."
        filters={CATEGORY_FILTERS}
        onFilterChange={handleFilterChange}
      />
      <DataTable<InventoryProduct>
        columns={COLUMNS}
        data={paginated}
        loading={isLoading}
        emptyMessage="No hay productos que coincidan con los filtros."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
