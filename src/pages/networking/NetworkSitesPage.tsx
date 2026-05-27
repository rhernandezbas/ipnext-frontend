import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useNetworkSites, useCreateNetworkSite, useUpdateNetworkSite, useDeleteNetworkSite } from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';
import styles from './NetworkSitesPage.module.css';

const TYPE_LABELS: Record<NetworkSite['type'], string> = {
  pop: 'POP',
  nodo: 'Nodo',
  datacenter: 'Datacenter',
  tower: 'Torre',
  other: 'Otro',
};

const TYPE_COLORS: Record<NetworkSite['type'], string> = {
  pop: styles.badgeBlue,
  nodo: styles.badgeGreen,
  datacenter: styles.badgePurple,
  tower: styles.badgeOrange,
  other: styles.badgeGray,
};

function TypeBadge({ type }: { type: NetworkSite['type'] }) {
  return (
    <span className={`${styles.typeBadge} ${TYPE_COLORS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: NetworkSite['status'] }) {
  const cssMap: Record<NetworkSite['status'], string> = {
    active: styles.statusOnline,
    inactive: styles.statusOffline,
    maintenance: styles.statusWarning,
  };
  const labelMap: Record<NetworkSite['status'], string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    maintenance: 'Mantenimiento',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

interface AddSiteModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<NetworkSite, 'id'>) => void;
}

function AddSiteModal({ onClose, onSubmit }: AddSiteModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<NetworkSite['type']>('nodo');
  const [uplink, setUplink] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, address, city, type, uplink, description,
      coordinates: null,
      status: 'active',
      deviceCount: 0,
      clientCount: 0,
      parentSiteId: null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Nuevo sitio</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="site-name">Nombre</label>
            <input id="site-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="site-address">Dirección</label>
            <input id="site-address" type="text" value={address} onChange={e => setAddress(e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="site-city">Ciudad</label>
              <input id="site-city" type="text" value={city} onChange={e => setCity(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="site-type">Tipo</label>
              <select id="site-type" value={type} onChange={e => setType(e.target.value as NetworkSite['type'])}>
                <option value="pop">POP</option>
                <option value="nodo">Nodo</option>
                <option value="datacenter">Datacenter</option>
                <option value="tower">Torre</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="site-uplink">Uplink</label>
            <input id="site-uplink" type="text" placeholder="e.g. 1 Gbps fibra" value={uplink} onChange={e => setUplink(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="site-description">Descripción</label>
            <input id="site-description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
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

interface EditSiteModalProps {
  site: NetworkSite;
  onClose: () => void;
  onSubmit: (data: Partial<NetworkSite>) => void;
}

function EditSiteModal({ site, onClose, onSubmit }: EditSiteModalProps) {
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address);
  const [city, setCity] = useState(site.city);
  const [type, setType] = useState<NetworkSite['type']>(site.type);
  const [uplink, setUplink] = useState(site.uplink);
  const [description, setDescription] = useState(site.description);
  const [status, setStatus] = useState<NetworkSite['status']>(site.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, address, city, type, uplink, description, status });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar sitio</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-name">Nombre</label>
            <input id="edit-site-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-address">Dirección</label>
            <input id="edit-site-address" type="text" value={address} onChange={e => setAddress(e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-site-city">Ciudad</label>
              <input id="edit-site-city" type="text" value={city} onChange={e => setCity(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-site-type">Tipo</label>
              <select id="edit-site-type" value={type} onChange={e => setType(e.target.value as NetworkSite['type'])}>
                <option value="pop">POP</option>
                <option value="nodo">Nodo</option>
                <option value="datacenter">Datacenter</option>
                <option value="tower">Torre</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-status">Estado</label>
            <select id="edit-site-status" value={status} onChange={e => setStatus(e.target.value as NetworkSite['status'])}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="maintenance">Mantenimiento</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-uplink">Uplink</label>
            <input id="edit-site-uplink" type="text" value={uplink} onChange={e => setUplink(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-description">Descripción</label>
            <input id="edit-site-description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
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
  { label: 'Nombre', key: 'name' as keyof NetworkSite },
  { label: 'Ciudad', key: 'city' as keyof NetworkSite },
  {
    label: 'Tipo',
    key: 'type' as keyof NetworkSite,
    render: (row: NetworkSite) => <TypeBadge type={row.type} />,
  },
  {
    label: 'Estado',
    key: 'status' as keyof NetworkSite,
    render: (row: NetworkSite) => <StatusBadge status={row.status} />,
  },
  { label: 'Dispositivos', key: 'deviceCount' as keyof NetworkSite },
  { label: 'Clientes', key: 'clientCount' as keyof NetworkSite },
  { label: 'Uplink', key: 'uplink' as keyof NetworkSite },
];

export default function NetworkSitesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<NetworkSite | null>(null);
  const { data: sites = [], isLoading } = useNetworkSites();
  const { mutate: createSite } = useCreateNetworkSite();
  const { mutate: updateSite } = useUpdateNetworkSite();
  const { mutate: deleteSite } = useDeleteNetworkSite();

  const total = sites.length;
  const active = sites.filter(s => s.status === 'active').length;
  const maintenance = sites.filter(s => s.status === 'maintenance').length;

  function handleDelete(row: NetworkSite) {
    if (window.confirm(`¿Eliminar sitio "${row.name}"?`)) {
      deleteSite(row.id);
    }
  }

  const actions = [
    { label: 'Editar', onClick: (row: NetworkSite) => setEditingSite(row) },
    { label: 'Eliminar', onClick: handleDelete },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sitios de red</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Nuevo sitio
        </button>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total sitios</span>
          <span className={styles.cardValue}>{total}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Activos</span>
          <span className={`${styles.cardValue} ${styles.cardValueOnline}`}>{active}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>En mantenimiento</span>
          <span className={`${styles.cardValue} ${styles.cardValueWarning}`}>{maintenance}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sites}
        loading={isLoading}
        actions={actions}
        emptyMessage="No se encontraron sitios de red."
      />

      {showModal && (
        <AddSiteModal
          onClose={() => setShowModal(false)}
          onSubmit={data => { createSite(data); setShowModal(false); }}
        />
      )}

      {editingSite && (
        <EditSiteModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSubmit={data => { updateSite({ id: editingSite.id, data }); setEditingSite(null); }}
        />
      )}
    </div>
  );
}
