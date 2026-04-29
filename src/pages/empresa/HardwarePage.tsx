import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useHardwareAssets, useCreateHardwareAsset, useUpdateHardwareAsset, useDeleteHardwareAsset } from '@/hooks/useHardware';
import type { HardwareAsset } from '@/types/hardware';
import styles from './HardwarePage.module.css';

const CATEGORY_LABELS: Record<HardwareAsset['category'], string> = {
  server: 'Servidor',
  switch: 'Switch',
  router: 'Router',
  ups: 'UPS',
  rack: 'Rack',
  cable: 'Cable',
  sfp: 'SFP',
  other: 'Otro',
};

function CategoryBadge({ category }: { category: HardwareAsset['category'] }) {
  return (
    <span className={`${styles.typeBadge} ${styles.badgeBlue}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function StatusBadge({ status }: { status: HardwareAsset['status'] }) {
  const cssMap: Record<HardwareAsset['status'], string> = {
    in_use: styles.statusOnline,
    spare: styles.statusWarning,
    maintenance: styles.statusWarning,
    retired: styles.statusOffline,
  };
  const labelMap: Record<HardwareAsset['status'], string> = {
    in_use: 'En uso',
    spare: 'Repuesto',
    maintenance: 'Mantenimiento',
    retired: 'Retirado',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function isWarrantyExpiringSoon(warrantyExpiry: string | null): boolean {
  if (!warrantyExpiry) return false;
  const expiry = new Date(warrantyExpiry);
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);
  return expiry <= in90Days && expiry >= new Date();
}

interface AddHardwareModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<HardwareAsset, 'id'>) => void;
}

function AddHardwareModal({ onClose, onSubmit }: AddHardwareModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HardwareAsset['category']>('server');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, category, model, manufacturer, serialNumber,
      purchaseDate, purchasePrice: Number(purchasePrice),
      warrantyExpiry: warrantyExpiry || null,
      location, notes,
      networkSiteId: null,
      status: 'spare',
      assignedTo: null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Agregar hardware</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="hw-name">Nombre</label>
              <input id="hw-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="hw-category">Categoría</label>
              <select id="hw-category" value={category} onChange={e => setCategory(e.target.value as HardwareAsset['category'])}>
                <option value="server">Servidor</option>
                <option value="switch">Switch</option>
                <option value="router">Router</option>
                <option value="ups">UPS</option>
                <option value="rack">Rack</option>
                <option value="cable">Cable</option>
                <option value="sfp">SFP</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="hw-model">Modelo</label>
              <input id="hw-model" type="text" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="hw-mfg">Fabricante</label>
              <input id="hw-mfg" type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="hw-serial">Nro. Serie</label>
            <input id="hw-serial" type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="hw-purchase-date">Fecha compra</label>
              <input id="hw-purchase-date" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="hw-price">Precio</label>
              <input id="hw-price" type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="hw-warranty">Garantía hasta</label>
              <input id="hw-warranty" type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="hw-location">Ubicación</label>
              <input id="hw-location" type="text" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="hw-notes">Notas</label>
            <input id="hw-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} />
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

interface EditHardwareModalProps {
  asset: HardwareAsset;
  onClose: () => void;
  onSubmit: (data: Partial<HardwareAsset>) => void;
}

function EditHardwareModal({ asset, onClose, onSubmit }: EditHardwareModalProps) {
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState<HardwareAsset['category']>(asset.category);
  const [model, setModel] = useState(asset.model);
  const [manufacturer, setManufacturer] = useState(asset.manufacturer);
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber);
  const [location, setLocation] = useState(asset.location);
  const [status, setStatus] = useState<HardwareAsset['status']>(asset.status);
  const [warrantyExpiry, setWarrantyExpiry] = useState(asset.warrantyExpiry ?? '');
  const [assignedTo, setAssignedTo] = useState(asset.assignedTo ?? '');
  const [notes, setNotes] = useState(asset.notes);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, category, model, manufacturer, serialNumber, location, status, warrantyExpiry: warrantyExpiry || null, assignedTo: assignedTo || null, notes });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar hardware</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-name">Nombre</label>
              <input id="edit-hw-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-category">Categoría</label>
              <select id="edit-hw-category" value={category} onChange={e => setCategory(e.target.value as HardwareAsset['category'])}>
                <option value="server">Servidor</option>
                <option value="switch">Switch</option>
                <option value="router">Router</option>
                <option value="ups">UPS</option>
                <option value="rack">Rack</option>
                <option value="cable">Cable</option>
                <option value="sfp">SFP</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-model">Modelo</label>
              <input id="edit-hw-model" type="text" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-mfg">Fabricante</label>
              <input id="edit-hw-mfg" type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-serial">Nro. Serie</label>
              <input id="edit-hw-serial" type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-status">Estado</label>
              <select id="edit-hw-status" value={status} onChange={e => setStatus(e.target.value as HardwareAsset['status'])}>
                <option value="in_use">En uso</option>
                <option value="spare">Repuesto</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="retired">Retirado</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-warranty">Garantía hasta</label>
              <input id="edit-hw-warranty" type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-hw-location">Ubicación</label>
              <input id="edit-hw-location" type="text" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-hw-assigned">Asignado a</label>
            <input id="edit-hw-assigned" type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-hw-notes">Notas</label>
            <input id="edit-hw-notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} />
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

const columns = [
  { label: 'Nombre', key: 'name' as keyof HardwareAsset },
  {
    label: 'Categoría',
    key: 'category' as keyof HardwareAsset,
    render: (row: HardwareAsset) => <CategoryBadge category={row.category} />,
  },
  { label: 'Modelo', key: 'model' as keyof HardwareAsset },
  { label: 'Fabricante', key: 'manufacturer' as keyof HardwareAsset },
  { label: 'Nro. Serie', key: 'serialNumber' as keyof HardwareAsset },
  { label: 'Ubicación', key: 'location' as keyof HardwareAsset },
  {
    label: 'Garantía hasta',
    key: 'warrantyExpiry' as keyof HardwareAsset,
    render: (row: HardwareAsset) => row.warrantyExpiry ?? '—',
  },
  {
    label: 'Estado',
    key: 'status' as keyof HardwareAsset,
    render: (row: HardwareAsset) => <StatusBadge status={row.status} />,
  },
  { label: 'Asignado a', key: 'assignedTo' as keyof HardwareAsset, render: (row: HardwareAsset) => row.assignedTo ?? '—' },
];

export default function HardwarePage() {
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<HardwareAsset | null>(null);
  const { data: assets = [], isLoading } = useHardwareAssets();
  const { mutate: createAsset } = useCreateHardwareAsset();
  const { mutate: updateAsset } = useUpdateHardwareAsset();
  const { mutate: deleteAsset } = useDeleteHardwareAsset();

  const total = assets.length;
  const inUse = assets.filter(a => a.status === 'in_use').length;
  const spare = assets.filter(a => a.status === 'spare').length;
  const maintenance = assets.filter(a => a.status === 'maintenance').length;
  const warrantyExpiring = assets.filter(a => isWarrantyExpiringSoon(a.warrantyExpiry)).length;

  function handleDelete(row: HardwareAsset) {
    if (window.confirm(`¿Eliminar activo "${row.name}"?`)) {
      deleteAsset(row.id);
    }
  }

  const actions = [
    { label: 'Editar', onClick: (row: HardwareAsset) => setEditingAsset(row) },
    { label: 'Eliminar', onClick: handleDelete },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Hardware</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Agregar hardware
        </button>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total activos</span>
          <span className={styles.cardValue}>{total}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>En uso</span>
          <span className={`${styles.cardValue} ${styles.cardValueOnline}`}>{inUse}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Repuesto</span>
          <span className={styles.cardValue}>{spare}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>En mantenimiento</span>
          <span className={`${styles.cardValue} ${styles.cardValueWarning}`}>{maintenance}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Garantía por vencer</span>
          <span className={`${styles.cardValue} ${styles.cardValueWarning}`}>{warrantyExpiring}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={assets}
        loading={isLoading}
        actions={actions}
        emptyMessage="No se encontraron activos de hardware."
      />

      {showModal && (
        <AddHardwareModal
          onClose={() => setShowModal(false)}
          onSubmit={data => { createAsset(data); setShowModal(false); }}
        />
      )}

      {editingAsset && (
        <EditHardwareModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSubmit={data => { updateAsset({ id: editingAsset.id, data }); setEditingAsset(null); }}
        />
      )}
    </div>
  );
}
