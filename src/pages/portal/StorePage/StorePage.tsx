import { useState } from 'react';
import { ProductsTab } from './components/ProductsTab';
import { OrdersTab } from './components/OrdersTab';
import styles from './StorePage.module.css';

type StoreTab = 'products' | 'orders';

const TABS: { key: StoreTab; label: string }[] = [
  { key: 'products', label: 'Productos' },
  { key: 'orders', label: 'Pedidos' },
];

/**
 * StorePage (store-admin) — administración de la Tienda de la app de
 * clientes: productos (ABM, gated `store.manage`) + pedidos (lectura). Página
 * gateada `store.read` a nivel ruta (`RequirePermission` en `App.tsx`, mismo
 * criterio que `PromosPage`) — sin esto la tienda de la app nace inerte,
 * no hay otro lugar donde el staff pueda cargar productos.
 *
 * Tabs internos por estado local — molde `NetworkAuditPage` (tabbar con
 * `aria-pressed`, sin un `<h1>` duplicado por tab: cada tab trae su propio
 * botón "Crear producto"/nada, el `<h1>` vive acá una sola vez).
 */
export default function StorePage() {
  const [activeTab, setActiveTab] = useState<StoreTab>('products');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>Portal /</span>
        <h1 className={styles.title}>Tienda</h1>
      </div>

      <div className={styles.tabbar} role="tablist" aria-label="Tienda">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'orders' && <OrdersTab />}
      </div>
    </div>
  );
}
