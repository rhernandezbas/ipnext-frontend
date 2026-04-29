import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useInventoryItems } from '@/hooks/useEmpresa';
import type { InventoryItem } from '@/types/empresa';
import styles from './InventoryDashboardPage.module.css';

const COLUMNS = [
  { label: 'Nombre', key: 'name' as keyof InventoryItem },
  { label: 'Categoría', key: 'category' as keyof InventoryItem },
  { label: 'Cantidad', key: 'quantity' as keyof InventoryItem },
  { label: 'Stock mínimo', key: 'minStock' as keyof InventoryItem },
  { label: 'Estado', key: 'status' as keyof InventoryItem },
];

export default function InventoryDashboardPage() {
  const { data: items = [], isLoading } = useInventoryItems();

  const totalArticulos = items.length;
  const totalCategorias = new Set(items.map(i => i.category)).size;
  const sinStock = items.filter(i => i.status === 'out_of_stock').length;
  const stockBajo = items.filter(i => i.status === 'low_stock').length;

  const alertItems = items.filter(
    i => i.status === 'low_stock' || i.status === 'out_of_stock',
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard de Inventario</h1>

      <div className={styles.kpiGrid} aria-label="KPI cards">
        <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{totalArticulos}</div>
          <div className={styles.kpiLabel}>Total artículos</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{totalCategorias}</div>
          <div className={styles.kpiLabel}>Categorías</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#ef4444' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{sinStock}</div>
          <div className={styles.kpiLabel}>Sin stock</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#f59e0b' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{stockBajo}</div>
          <div className={styles.kpiLabel}>Stock bajo</div>
        </div>
      </div>

      {isLoading ? (
        <p className={styles.loading}>Cargando...</p>
      ) : null}

      <DataTable<InventoryItem>
        columns={COLUMNS}
        data={alertItems}
        loading={isLoading}
        emptyMessage="No hay artículos con bajo stock o sin stock."
      />
    </div>
  );
}
