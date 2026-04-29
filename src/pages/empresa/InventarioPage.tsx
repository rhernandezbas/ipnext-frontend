import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import {
  useInventoryProducts,
  useInventoryUnits,
  useCreateInventoryUnit,
  useUpdateInventoryProduct,
  useDeleteInventoryProduct,
  useDeleteInventoryUnit,
  useUpdateInventoryUnit,
} from '@/hooks/useEmpresa';
import type { InventoryProduct, InventoryUnit } from '@/types/empresa';
import styles from './InventarioPage.module.css';

type Tab = 'productos' | 'items';

const CATEGORY_LABELS: Record<InventoryProduct['category'], string> = {
  router: 'Router',
  cable: 'Cable',
  splitter: 'Splitter',
  onu: 'ONU',
  tools: 'Herramientas',
  other: 'Otro',
};

function CategoryBadge({ category }: { category: InventoryProduct['category'] }) {
  return <span className={styles.categoryBadge}>{CATEGORY_LABELS[category]}</span>;
}

function ProductStatus({ status }: { status: InventoryProduct['status'] }) {
  const cssMap: Record<InventoryProduct['status'], string> = {
    in_stock: styles.statusInStock,
    low_stock: styles.statusLowStock,
    out_of_stock: styles.statusOutOfStock,
  };
  const labelMap: Record<InventoryProduct['status'], string> = {
    in_stock: 'En stock',
    low_stock: 'Stock bajo',
    out_of_stock: 'Sin stock',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function UnitStatus({ status }: { status: InventoryUnit['status'] }) {
  const cssMap: Record<InventoryUnit['status'], string> = {
    available: styles.statusInStock,
    assigned: styles.statusLowStock,
    damaged: styles.statusOutOfStock,
    retired: styles.categoryBadge,
  };
  const labelMap: Record<InventoryUnit['status'], string> = {
    available: 'Disponible',
    assigned: 'Asignado',
    damaged: 'Dañado',
    retired: 'Retirado',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `$${price.toLocaleString('es-AR')}`;
}

// ── Add Item Modal ─────────────────────────────────────────────────────────

interface AddUnitModalProps {
  products: InventoryProduct[];
  onClose: () => void;
  onSubmit: (data: Omit<InventoryUnit, 'id'>) => void;
}

function AddUnitModal({ products, onClose, onSubmit }: AddUnitModalProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [serialNumber, setSerialNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [location, setLocation] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');

  const selectedProduct = products.find(p => p.id === productId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      productId,
      productName: selectedProduct?.name ?? '',
      serialNumber: serialNumber || null,
      barcode: barcode || null,
      status: 'available',
      location,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      assignedToClientId: null,
      assignedAt: null,
      notes,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Agregar ítem</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="unit-product">Producto</label>
            <select
              id="unit-product"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="unit-serial">Nro. serie</label>
              <input
                id="unit-serial"
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="unit-barcode">Código de barras</label>
              <input
                id="unit-barcode"
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="unit-location">Ubicación</label>
            <input
              id="unit-location"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="unit-purchase-date">Fecha compra</label>
              <input
                id="unit-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="unit-purchase-price">Precio compra</label>
              <input
                id="unit-purchase-price"
                type="number"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                min={0}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="unit-notes">Notas</label>
            <input
              id="unit-notes"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Productos Tab ──────────────────────────────────────────────────────────

const productColumns = [
  { label: 'SKU', key: 'sku' as keyof InventoryProduct },
  { label: 'Nombre', key: 'name' as keyof InventoryProduct },
  {
    label: 'Categoría',
    key: 'category' as keyof InventoryProduct,
    render: (row: InventoryProduct) => <CategoryBadge category={row.category} />,
  },
  {
    label: 'Precio unitario',
    key: 'unitPrice' as keyof InventoryProduct,
    render: (row: InventoryProduct) => formatPrice(row.unitPrice),
  },
  { label: 'Stock total', key: 'totalStock' as keyof InventoryProduct },
  { label: 'Stock mínimo', key: 'minStock' as keyof InventoryProduct },
  {
    label: 'Estado',
    key: 'status' as keyof InventoryProduct,
    render: (row: InventoryProduct) => <ProductStatus status={row.status} />,
  },
  { label: 'Proveedor', key: 'supplier' as keyof InventoryProduct },
];

// ── Ítems Tab ──────────────────────────────────────────────────────────────

const unitColumns = [
  {
    label: 'Nro. Serie',
    key: 'serialNumber' as keyof InventoryUnit,
    render: (row: InventoryUnit) => row.serialNumber ?? '—',
  },
  {
    label: 'Código de barras',
    key: 'barcode' as keyof InventoryUnit,
    render: (row: InventoryUnit) => row.barcode ?? '—',
  },
  { label: 'Producto', key: 'productName' as keyof InventoryUnit },
  {
    label: 'Estado',
    key: 'status' as keyof InventoryUnit,
    render: (row: InventoryUnit) => <UnitStatus status={row.status} />,
  },
  { label: 'Ubicación', key: 'location' as keyof InventoryUnit },
  {
    label: 'Fecha compra',
    key: 'purchaseDate' as keyof InventoryUnit,
    render: (row: InventoryUnit) => row.purchaseDate ?? '—',
  },
  {
    label: 'Precio compra',
    key: 'purchasePrice' as keyof InventoryUnit,
    render: (row: InventoryUnit) => formatPrice(row.purchasePrice),
  },
  {
    label: 'Cliente asignado',
    key: 'assignedToClientId' as keyof InventoryUnit,
    render: (row: InventoryUnit) => row.assignedToClientId ?? '—',
  },
];

// ── Edit Product Modal ─────────────────────────────────────────────────────

interface EditProductModalProps {
  product: InventoryProduct;
  onClose: () => void;
  onSubmit: (data: Partial<InventoryProduct>) => void;
}

function EditProductModal({ product, onClose, onSubmit }: EditProductModalProps) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [category, setCategory] = useState<InventoryProduct['category']>(product.category);
  const [unitPrice, setUnitPrice] = useState(product.unitPrice != null ? String(product.unitPrice) : '');
  const [minStock, setMinStock] = useState(String(product.minStock));
  const [supplier, setSupplier] = useState(product.supplier);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, sku, category, unitPrice: unitPrice ? Number(unitPrice) : null, minStock: Number(minStock), supplier });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar producto</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-name">Nombre</label>
              <input id="edit-prod-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-sku">SKU</label>
              <input id="edit-prod-sku" type="text" value={sku} onChange={e => setSku(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-category">Categoría</label>
              <select id="edit-prod-category" value={category} onChange={e => setCategory(e.target.value as InventoryProduct['category'])}>
                <option value="router">Router</option>
                <option value="cable">Cable</option>
                <option value="splitter">Splitter</option>
                <option value="onu">ONU</option>
                <option value="tools">Herramientas</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-price">Precio unit.</label>
              <input id="edit-prod-price" type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-min-stock">Stock mínimo</label>
              <input id="edit-prod-min-stock" type="number" value={minStock} onChange={e => setMinStock(e.target.value)} min={0} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-prod-supplier">Proveedor</label>
              <input id="edit-prod-supplier" type="text" value={supplier} onChange={e => setSupplier(e.target.value)} />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<Tab>('productos');
  const [showModal, setShowModal] = useState(false);
  const [filterProductId, setFilterProductId] = useState('');
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);

  const { data: products = [], isLoading: loadingProducts } = useInventoryProducts();
  const { data: units = [], isLoading: loadingUnits } = useInventoryUnits(filterProductId || undefined);
  const { mutate: createUnit } = useCreateInventoryUnit();
  const { mutate: updateProduct } = useUpdateInventoryProduct();
  const { mutate: deleteProduct } = useDeleteInventoryProduct();
  const { mutate: deleteUnit } = useDeleteInventoryUnit();
  const { mutate: updateUnit } = useUpdateInventoryUnit();

  // Summary stats (based on products catalog)
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.status === 'low_stock').length;
  const outOfStockCount = products.filter(p => p.status === 'out_of_stock').length;

  const productActions = [
    { label: 'Editar', onClick: (row: InventoryProduct) => setEditingProduct(row) },
    { label: 'Eliminar', onClick: (row: InventoryProduct) => { if (window.confirm(`¿Eliminar producto "${row.name}"?`)) deleteProduct(row.id); } },
  ];

  const unitActions = [
    { label: 'Asignar a cliente', onClick: (row: InventoryUnit) => { const clientId = window.prompt('ID del cliente:'); if (clientId) updateUnit({ id: row.id, data: { assignedToClientId: clientId, status: 'assigned', assignedAt: new Date().toISOString() } }); } },
    { label: 'Marcar dañado', onClick: (row: InventoryUnit) => { if (window.confirm(`¿Marcar "${row.serialNumber ?? row.id}" como dañado?`)) updateUnit({ id: row.id, data: { status: 'damaged' } }); } },
    { label: 'Retirar', onClick: (row: InventoryUnit) => { if (window.confirm(`¿Retirar "${row.serialNumber ?? row.id}"?`)) updateUnit({ id: row.id, data: { status: 'retired' } }); } },
  ];

  function handleCreateUnit(data: Omit<InventoryUnit, 'id'>) {
    createUnit(data);
    setShowModal(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inventario</h1>
        {activeTab === 'items' && (
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            Agregar ítem
          </button>
        )}
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total productos</span>
          <span className={styles.cardValue}>{totalProducts}</span>
        </div>
        <div className={`${styles.card} ${styles.cardLowStock}`}>
          <span className={styles.cardLabel}>Stock bajo</span>
          <span className={styles.cardValue}>{lowStockCount}</span>
        </div>
        <div className={`${styles.card} ${styles.cardOutOfStock}`}>
          <span className={styles.cardLabel}>Sin stock</span>
          <span className={styles.cardValue}>{outOfStockCount}</span>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className={styles.alertBanner}>
          <span>⚠</span>
          <span>Hay {lowStockCount} productos con stock bajo</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        <button
          className={`${styles.btnSecondary} ${activeTab === 'productos' ? styles.btnPrimary : ''}`}
          onClick={() => setActiveTab('productos')}
        >
          Productos
        </button>
        <button
          className={`${styles.btnSecondary} ${activeTab === 'items' ? styles.btnPrimary : ''}`}
          onClick={() => setActiveTab('items')}
        >
          Ítems
        </button>
      </div>

      {activeTab === 'productos' && (
        <DataTable
          columns={productColumns}
          data={products}
          loading={loadingProducts}
          actions={productActions}
          emptyMessage="No se encontraron productos."
        />
      )}

      {activeTab === 'items' && (
        <>
          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterProductId}
              onChange={e => setFilterProductId(e.target.value)}
            >
              <option value="">Todos los productos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <DataTable
            columns={unitColumns}
            data={units}
            loading={loadingUnits}
            actions={unitActions}
            emptyMessage="No se encontraron ítems."
          />
        </>
      )}

      {showModal && (
        <AddUnitModal
          products={products}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateUnit}
        />
      )}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={data => { updateProduct({ id: editingProduct.id, data }); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}
