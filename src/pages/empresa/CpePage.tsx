import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useCpeDevices, useCreateCpeDevice, useDeleteCpeDevice, useAssignCpeToClient } from '@/hooks/useCpe';
import type { CpeDevice, CpeType } from '@/types/cpe';
import styles from './CpePage.module.css';

const TYPE_LABELS: Record<CpeType, string> = {
  router: 'Router',
  onu: 'ONU',
  ont: 'ONT',
  modem: 'Modem',
  ap: 'AP',
  cpe_radio: 'CPE Radio',
};

function TypeBadge({ type }: { type: CpeType }) {
  return (
    <span className={`${styles.typeBadge} ${styles.badgeBlue}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: CpeDevice['status'] }) {
  const cssMap: Record<CpeDevice['status'], string> = {
    online: styles.statusOnline,
    offline: styles.statusOffline,
    unconfigured: styles.statusWarning,
    error: styles.statusOffline,
  };
  const labelMap: Record<CpeDevice['status'], string> = {
    online: 'Online',
    offline: 'Offline',
    unconfigured: 'Sin configurar',
    error: 'Error',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface AddCpeModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<CpeDevice, 'id'>) => void;
}

function AddCpeModal({ onClose, onSubmit }: AddCpeModalProps) {
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [type, setType] = useState<CpeType>('router');
  const [macAddress, setMacAddress] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      serialNumber, model, manufacturer, type, macAddress, firmwareVersion,
      ipAddress: null, status: 'unconfigured', clientId: null, clientName: null,
      nasId: null, networkSiteId: null, lastSeen: null, signal: null, connectedAt: null,
      description: '',
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Agregar CPE</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-serial">Nro. Serie</label>
              <input id="cpe-serial" type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} required autoFocus />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-model">Modelo</label>
              <input id="cpe-model" type="text" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-mfg">Fabricante</label>
              <input id="cpe-mfg" type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-type">Tipo</label>
              <select id="cpe-type" value={type} onChange={e => setType(e.target.value as CpeType)}>
                <option value="router">Router</option>
                <option value="onu">ONU</option>
                <option value="ont">ONT</option>
                <option value="modem">Modem</option>
                <option value="ap">AP</option>
                <option value="cpe_radio">CPE Radio</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-mac">MAC</label>
              <input id="cpe-mac" type="text" value={macAddress} onChange={e => setMacAddress(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cpe-firmware">Firmware</label>
              <input id="cpe-firmware" type="text" value={firmwareVersion} onChange={e => setFirmwareVersion(e.target.value)} />
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

interface AssignClientModalProps {
  device: CpeDevice;
  onClose: () => void;
  onSubmit: (clientId: string, clientName: string) => void;
}

function AssignClientModal({ device, onClose, onSubmit }: AssignClientModalProps) {
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(clientId, clientName);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Asignar CPE a cliente</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Serie: <strong>{device.serialNumber}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="assign-client-id">ID Cliente</label>
            <input id="assign-client-id" type="text" value={clientId} onChange={e => setClientId(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="assign-client-name">Nombre cliente</label>
            <input id="assign-client-name" type="text" value={clientName} onChange={e => setClientName(e.target.value)} required />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Asignar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CpeDetailModalProps {
  device: CpeDevice;
  onClose: () => void;
}

function CpeDetailModal({ device, onClose }: CpeDetailModalProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Detalle CPE — {device.serialNumber}</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', margin: '1rem 0' }}>
          {[
            ['Modelo', device.model],
            ['Fabricante', device.manufacturer],
            ['Tipo', device.type],
            ['MAC', device.macAddress],
            ['IP', device.ipAddress ?? '—'],
            ['Firmware', device.firmwareVersion],
            ['Estado', device.status],
            ['Cliente', device.clientName ?? '—'],
            ['Señal', device.signal !== null ? `${device.signal} dBm` : '—'],
            ['Conectado', device.connectedAt ?? '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>{label}</dt>
              <dd style={{ fontWeight: 600, margin: 0 }}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const columns = [
  { label: 'Nro. Serie', key: 'serialNumber' as keyof CpeDevice },
  { label: 'Modelo', key: 'model' as keyof CpeDevice },
  { label: 'Fabricante', key: 'manufacturer' as keyof CpeDevice },
  {
    label: 'Tipo',
    key: 'type' as keyof CpeDevice,
    render: (row: CpeDevice) => <TypeBadge type={row.type} />,
  },
  { label: 'IP', key: 'ipAddress' as keyof CpeDevice, render: (row: CpeDevice) => row.ipAddress ?? '—' },
  { label: 'MAC', key: 'macAddress' as keyof CpeDevice },
  {
    label: 'Estado',
    key: 'status' as keyof CpeDevice,
    render: (row: CpeDevice) => <StatusBadge status={row.status} />,
  },
  { label: 'Cliente', key: 'clientName' as keyof CpeDevice, render: (row: CpeDevice) => row.clientName ?? '—' },
  { label: 'Firmware', key: 'firmwareVersion' as keyof CpeDevice },
  { label: 'Último contacto', key: 'lastSeen' as keyof CpeDevice, render: (row: CpeDevice) => formatDate(row.lastSeen) },
  {
    label: 'Señal (dBm)',
    key: 'signal' as keyof CpeDevice,
    render: (row: CpeDevice) => row.signal !== null ? `${row.signal} dBm` : '—',
  },
];

export default function CpePage() {
  const [showModal, setShowModal] = useState(false);
  const [viewDevice, setViewDevice] = useState<CpeDevice | null>(null);
  const [assignDevice, setAssignDevice] = useState<CpeDevice | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: devices = [], isLoading } = useCpeDevices();
  const { mutate: createDevice } = useCreateCpeDevice();
  const { mutate: deleteDevice } = useDeleteCpeDevice();
  const { mutate: assignToClient } = useAssignCpeToClient();

  const filtered = devices.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (typeFilter && d.type !== typeFilter) return false;
    if (search && !d.serialNumber.toLowerCase().includes(search.toLowerCase()) &&
        !d.model.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const total = devices.length;
  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const unconfigured = devices.filter(d => d.status === 'unconfigured').length;

  function handleDelete(row: CpeDevice) {
    if (window.confirm(`¿Eliminar CPE "${row.serialNumber}"?`)) {
      deleteDevice(row.id);
    }
  }

  function handleReiniciar(row: CpeDevice) {
    if (window.confirm(`¿Reiniciar CPE "${row.serialNumber}"?`)) {
      alert(`Reinicio solicitado para ${row.serialNumber}`);
    }
  }

  const actions = [
    { label: 'Ver', onClick: (row: CpeDevice) => setViewDevice(row) },
    { label: 'Asignar a cliente', onClick: (row: CpeDevice) => setAssignDevice(row) },
    { label: 'Reiniciar', onClick: handleReiniciar },
    { label: 'Eliminar', onClick: handleDelete },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>CPE — Equipos en cliente</h1>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Agregar CPE
        </button>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total CPE</span>
          <span className={styles.cardValue}>{total}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Online</span>
          <span className={`${styles.cardValue} ${styles.cardValueOnline}`}>{online}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Offline</span>
          <span className={`${styles.cardValue} ${styles.cardValueOffline}`}>{offline}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Sin configurar</span>
          <span className={`${styles.cardValue} ${styles.cardValueWarning}`}>{unconfigured}</span>
        </div>
      </div>

      <div className={styles.filterRow}>
        <input
          type="text"
          placeholder="Buscar por serie o modelo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.filterSelect}
          aria-label="Buscar CPE"
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unconfigured">Sin configurar</option>
          <option value="error">Error</option>
        </select>
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="router">Router</option>
          <option value="onu">ONU</option>
          <option value="ont">ONT</option>
          <option value="modem">Modem</option>
          <option value="ap">AP</option>
          <option value="cpe_radio">CPE Radio</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        actions={actions}
        emptyMessage="No se encontraron equipos CPE."
      />

      {showModal && (
        <AddCpeModal
          onClose={() => setShowModal(false)}
          onSubmit={data => { createDevice(data); setShowModal(false); }}
        />
      )}

      {viewDevice && (
        <CpeDetailModal device={viewDevice} onClose={() => setViewDevice(null)} />
      )}

      {assignDevice && (
        <AssignClientModal
          device={assignDevice}
          onClose={() => setAssignDevice(null)}
          onSubmit={(clientId, clientName) => {
            assignToClient({ id: assignDevice.id, clientId, clientName });
            setAssignDevice(null);
          }}
        />
      )}
    </div>
  );
}
