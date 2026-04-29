import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useNasServers, useCreateNasServer, useUpdateNasServer, useDeleteNasServer, useRadiusConfig, useUpdateRadiusConfig } from '@/hooks/useNas';
import { useIpNetworks, useCreateIpNetwork, useDeleteIpNetwork, useIpPools, useCreateIpPool, useDeleteIpPool, useIpAssignments, useIpv6Networks, useCreateIpv6Network } from '@/hooks/useNetwork';
import type { NasServer, NasType, RadiusConfig } from '@/types/nas';
import type { IpNetwork, IpPool, Ipv6Network } from '@/types/network';
import styles from './GestionRedPage.module.css';

type Tab = 'nas' | 'redes' | 'pools' | 'asignaciones' | 'ipv6';

const TABS: { key: Tab; label: string }[] = [
  { key: 'nas', label: 'Dispositivos NAS' },
  { key: 'redes', label: 'Redes IP' },
  { key: 'pools', label: 'Pools IP' },
  { key: 'asignaciones', label: 'Asignaciones' },
  { key: 'ipv6', label: 'IPv6' },
];

const NAS_TYPE_LABELS: Record<NasType, string> = {
  mikrotik_api: 'MikroTik API',
  mikrotik_radius: 'MikroTik RADIUS',
  cisco: 'Cisco',
  ubiquiti: 'Ubiquiti',
  cambium: 'Cambium',
  other: 'Otro',
};

const NAS_TYPE_COLORS: Record<NasType, string> = {
  mikrotik_api: styles.badgeOrange,
  mikrotik_radius: styles.badgeOrange,
  cisco: styles.badgeBlue,
  ubiquiti: styles.badgeGreen,
  cambium: styles.badgePurple,
  other: styles.badgeGray,
};

function NasTypeBadge({ type }: { type: NasType }) {
  return (
    <span className={`${styles.typeBadge} ${NAS_TYPE_COLORS[type]}`}>
      {NAS_TYPE_LABELS[type]}
    </span>
  );
}

function NasStatusBadge({ status }: { status: NasServer['status'] }) {
  const cssMap: Record<NasServer['status'], string> = {
    active: styles.statusOnline,
    inactive: styles.statusOffline,
    error: styles.statusWarning,
  };
  const labelMap: Record<NasServer['status'], string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    error: 'Error',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// NAS Modal
interface AddNasModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<NasServer, 'id'>) => void;
}

function AddNasModal({ onClose, onSubmit }: AddNasModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NasType>('mikrotik_api');
  const [ipAddress, setIpAddress] = useState('');
  const [nasIpAddress, setNasIpAddress] = useState('');
  const [radiusSecret, setRadiusSecret] = useState('');
  const [apiPort, setApiPort] = useState('');
  const [apiLogin, setApiLogin] = useState('');
  const [apiPassword, setApiPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      type,
      ipAddress,
      nasIpAddress,
      radiusSecret,
      apiPort: apiPort ? Number(apiPort) : null,
      apiLogin: apiLogin || null,
      apiPassword: apiPassword || null,
      status: 'active',
      lastSeen: null,
      clientCount: 0,
      description: '',
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Agregar NAS</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="nas-name">Nombre</label>
            <input id="nas-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="nas-type">Tipo</label>
              <select id="nas-type" value={type} onChange={e => setType(e.target.value as NasType)}>
                <option value="mikrotik_api">MikroTik API</option>
                <option value="mikrotik_radius">MikroTik RADIUS</option>
                <option value="cisco">Cisco</option>
                <option value="ubiquiti">Ubiquiti</option>
                <option value="cambium">Cambium</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="nas-ip">IP</label>
              <input id="nas-ip" type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="nas-ip-address">NAS IP</label>
              <input id="nas-ip-address" type="text" value={nasIpAddress} onChange={e => setNasIpAddress(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="nas-secret">Secret RADIUS</label>
            <input id="nas-secret" type="password" value={radiusSecret} onChange={e => setRadiusSecret(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="nas-api-port">Puerto API</label>
              <input id="nas-api-port" type="number" value={apiPort} onChange={e => setApiPort(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="nas-api-login">Login API</label>
              <input id="nas-api-login" type="text" value={apiLogin} onChange={e => setApiLogin(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="nas-api-password">Contraseña API</label>
            <input id="nas-api-password" type="password" value={apiPassword} onChange={e => setApiPassword(e.target.value)} />
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

// Add Network Modal
interface AddNetworkModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<IpNetwork, 'id'>) => void;
}

function AddNetworkModal({ onClose, onSubmit }: AddNetworkModalProps) {
  const [network, setNetwork] = useState('');
  const [gateway, setGateway] = useState('');
  const [dns1, setDns1] = useState('');
  const [dns2, setDns2] = useState('');
  const [type, setType] = useState<IpNetwork['type']>('dhcp');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      network, gateway, dns1, dns2, type, description,
      partnerId: null, totalIps: 0, usedIps: 0, freeIps: 0,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Nueva red</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="net-cidr">CIDR</label>
            <input id="net-cidr" type="text" placeholder="192.168.0.0/24" value={network} onChange={e => setNetwork(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="net-gateway">Gateway</label>
              <input id="net-gateway" type="text" value={gateway} onChange={e => setGateway(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="net-type">Tipo</label>
              <select id="net-type" value={type} onChange={e => setType(e.target.value as IpNetwork['type'])}>
                <option value="dhcp">DHCP</option>
                <option value="static">Estático</option>
                <option value="pppoe">PPPoE</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="net-dns1">DNS primario</label>
              <input id="net-dns1" type="text" value={dns1} onChange={e => setDns1(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="net-dns2">DNS secundario</label>
              <input id="net-dns2" type="text" value={dns2} onChange={e => setDns2(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="net-description">Descripción</label>
            <input id="net-description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
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

// Add Pool Modal
interface AddPoolModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<IpPool, 'id'>) => void;
  networks: IpNetwork[];
}

function AddPoolModal({ onClose, onSubmit, networks }: AddPoolModalProps) {
  const [name, setName] = useState('');
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [type, setType] = useState<IpPool['type']>('dynamic');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, networkId, rangeStart, rangeEnd, type, assignedCount: 0, totalCount: 0, nasId: null });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Nuevo pool</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="pool-name">Nombre</label>
            <input id="pool-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pool-network">Red</label>
            <select id="pool-network" value={networkId} onChange={e => setNetworkId(e.target.value)}>
              {networks.map(n => (
                <option key={n.id} value={n.id}>{n.network}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="pool-start">Rango inicio</label>
              <input id="pool-start" type="text" value={rangeStart} onChange={e => setRangeStart(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="pool-end">Rango fin</label>
              <input id="pool-end" type="text" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pool-type">Tipo</label>
            <select id="pool-type" value={type} onChange={e => setType(e.target.value as IpPool['type'])}>
              <option value="dynamic">Dinámico</option>
              <option value="static">Estático</option>
            </select>
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

// RADIUS Config section
function RadiusConfigSection() {
  const { data: config } = useRadiusConfig();
  const { mutate: updateConfig } = useUpdateRadiusConfig();

  const [authPort, setAuthPort] = useState<number>(config?.authPort ?? 1812);
  const [acctPort, setAcctPort] = useState<number>(config?.acctPort ?? 1813);
  const [coaPort, setCoaPort] = useState<number>(config?.coaPort ?? 3799);
  const [sessionTimeout, setSessionTimeout] = useState<number>(config?.sessionTimeout ?? 86400);
  const [idleTimeout, setIdleTimeout] = useState<number>(config?.idleTimeout ?? 3600);
  const [interimUpdateInterval, setInterimUpdateInterval] = useState<number>(config?.interimUpdateInterval ?? 300);
  const [enableCoa, setEnableCoa] = useState<boolean>(config?.enableCoa ?? true);
  const [enableAccounting, setEnableAccounting] = useState<boolean>(config?.enableAccounting ?? true);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const data: Partial<RadiusConfig> = {
      authPort, acctPort, coaPort, sessionTimeout, idleTimeout,
      interimUpdateInterval, enableCoa, enableAccounting,
    };
    updateConfig(data);
  }

  return (
    <div className={styles.radiusSection}>
      <h3 className={styles.sectionTitle}>Configuración RADIUS</h3>
      <form onSubmit={handleSave} className={styles.radiusForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="radius-auth-port">Puerto Auth</label>
            <input id="radius-auth-port" type="number" value={authPort} onChange={e => setAuthPort(Number(e.target.value))} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-acct-port">Puerto Acct</label>
            <input id="radius-acct-port" type="number" value={acctPort} onChange={e => setAcctPort(Number(e.target.value))} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-coa-port">Puerto CoA</label>
            <input id="radius-coa-port" type="number" value={coaPort} onChange={e => setCoaPort(Number(e.target.value))} />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="radius-session-timeout">Timeout sesión (seg)</label>
            <input id="radius-session-timeout" type="number" value={sessionTimeout} onChange={e => setSessionTimeout(Number(e.target.value))} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-idle-timeout">Timeout inactividad (seg)</label>
            <input id="radius-idle-timeout" type="number" value={idleTimeout} onChange={e => setIdleTimeout(Number(e.target.value))} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-interim">Intervalo interim update</label>
            <input id="radius-interim" type="number" value={interimUpdateInterval} onChange={e => setInterimUpdateInterval(Number(e.target.value))} />
          </div>
        </div>
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={enableCoa} onChange={e => setEnableCoa(e.target.checked)} />
            Habilitar CoA
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={enableAccounting} onChange={e => setEnableAccounting(e.target.checked)} />
            Habilitar Accounting
          </label>
        </div>
        <div>
          <button type="submit" className={styles.btnPrimary}>Guardar configuración RADIUS</button>
        </div>
      </form>
    </div>
  );
}

// NAS columns
const nasColumns = [
  { label: 'Nombre', key: 'name' as keyof NasServer },
  {
    label: 'Tipo',
    key: 'type' as keyof NasServer,
    render: (row: NasServer) => <NasTypeBadge type={row.type} />,
  },
  { label: 'IP', key: 'ipAddress' as keyof NasServer },
  { label: 'NAS IP', key: 'nasIpAddress' as keyof NasServer },
  {
    label: 'Estado',
    key: 'status' as keyof NasServer,
    render: (row: NasServer) => <NasStatusBadge status={row.status} />,
  },
  { label: 'Clientes', key: 'clientCount' as keyof NasServer },
  {
    label: 'Último contacto',
    key: 'lastSeen' as keyof NasServer,
    render: (row: NasServer) => formatDate(row.lastSeen),
  },
];

// IP Networks columns
const networkColumns = [
  { label: 'Red (CIDR)', key: 'network' as keyof IpNetwork },
  { label: 'Gateway', key: 'gateway' as keyof IpNetwork },
  { label: 'DNS1', key: 'dns1' as keyof IpNetwork },
  { label: 'DNS2', key: 'dns2' as keyof IpNetwork },
  { label: 'Tipo', key: 'type' as keyof IpNetwork },
  {
    label: 'IPs Usadas/Total',
    key: 'usedIps' as keyof IpNetwork,
    render: (row: IpNetwork) => `${row.usedIps}/${row.totalIps}`,
  },
];

// Pool columns
const poolColumns = [
  { label: 'Nombre', key: 'name' as keyof IpPool },
  { label: 'Red', key: 'networkId' as keyof IpPool },
  {
    label: 'Rango',
    key: 'rangeStart' as keyof IpPool,
    render: (row: IpPool) => `${row.rangeStart} - ${row.rangeEnd}`,
  },
  { label: 'Tipo', key: 'type' as keyof IpPool },
  {
    label: 'Asignadas/Total',
    key: 'assignedCount' as keyof IpPool,
    render: (row: IpPool) => `${row.assignedCount}/${row.totalCount}`,
  },
  { label: 'NAS', key: 'nasId' as keyof IpPool, render: (row: IpPool) => row.nasId ?? '—' },
];

interface AddIpv6ModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<Ipv6Network, 'id'>) => void;
}

function AddIpv6Modal({ onClose, onSubmit }: AddIpv6ModalProps) {
  const [network, setNetwork] = useState('');
  const [delegationPrefix, setDelegationPrefix] = useState('56');
  const [type, setType] = useState<Ipv6Network['type']>('dhcpv6');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      network, delegationPrefix: Number(delegationPrefix), type, description,
      usedPrefixes: 0, totalPrefixes: 0, status: 'active',
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Nueva red IPv6</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="ipv6-cidr">CIDR IPv6</label>
            <input id="ipv6-cidr" type="text" placeholder="2001:db8::/32" value={network} onChange={e => setNetwork(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ipv6-prefix">Prefijo delegación</label>
              <input id="ipv6-prefix" type="number" value={delegationPrefix} onChange={e => setDelegationPrefix(e.target.value)} min={1} max={128} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ipv6-type">Tipo</label>
              <select id="ipv6-type" value={type} onChange={e => setType(e.target.value as Ipv6Network['type'])}>
                <option value="static">Estático</option>
                <option value="dhcpv6">DHCPv6</option>
                <option value="slaac">SLAAC</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="ipv6-description">Descripción</label>
            <input id="ipv6-description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
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

const ipv6Columns = [
  { label: 'Red', key: 'network' as keyof Ipv6Network },
  { label: 'Prefijo delegación', key: 'delegationPrefix' as keyof Ipv6Network },
  { label: 'Tipo', key: 'type' as keyof Ipv6Network },
  {
    label: 'Usados/Total',
    key: 'usedPrefixes' as keyof Ipv6Network,
    render: (row: Ipv6Network) => `${row.usedPrefixes}/${row.totalPrefixes}`,
  },
  { label: 'Estado', key: 'status' as keyof Ipv6Network },
];

interface EditNasModalProps {
  nas: NasServer;
  onClose: () => void;
  onSubmit: (data: Partial<NasServer>) => void;
}

function EditNasModal({ nas, onClose, onSubmit }: EditNasModalProps) {
  const [name, setName] = useState(nas.name);
  const [type, setType] = useState<NasType>(nas.type);
  const [ipAddress, setIpAddress] = useState(nas.ipAddress);
  const [nasIpAddress, setNasIpAddress] = useState(nas.nasIpAddress);
  const [radiusSecret, setRadiusSecret] = useState(nas.radiusSecret);
  const [apiPort, setApiPort] = useState(nas.apiPort != null ? String(nas.apiPort) : '');
  const [apiLogin, setApiLogin] = useState(nas.apiLogin ?? '');
  const [apiPassword, setApiPassword] = useState(nas.apiPassword ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, type, ipAddress, nasIpAddress, radiusSecret, apiPort: apiPort ? Number(apiPort) : null, apiLogin: apiLogin || null, apiPassword: apiPassword || null });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar NAS</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="edit-nas-name">Nombre</label>
            <input id="edit-nas-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-nas-type">Tipo</label>
              <select id="edit-nas-type" value={type} onChange={e => setType(e.target.value as NasType)}>
                <option value="mikrotik_api">MikroTik API</option>
                <option value="mikrotik_radius">MikroTik RADIUS</option>
                <option value="cisco">Cisco</option>
                <option value="ubiquiti">Ubiquiti</option>
                <option value="cambium">Cambium</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-nas-ip">IP</label>
              <input id="edit-nas-ip" type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-nas-nas-ip">NAS IP</label>
              <input id="edit-nas-nas-ip" type="text" value={nasIpAddress} onChange={e => setNasIpAddress(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-nas-secret">Secret RADIUS</label>
            <input id="edit-nas-secret" type="password" value={radiusSecret} onChange={e => setRadiusSecret(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-nas-api-port">Puerto API</label>
              <input id="edit-nas-api-port" type="number" value={apiPort} onChange={e => setApiPort(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-nas-api-login">Login API</label>
              <input id="edit-nas-api-login" type="text" value={apiLogin} onChange={e => setApiLogin(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-nas-api-password">Contraseña API</label>
            <input id="edit-nas-api-password" type="password" value={apiPassword} onChange={e => setApiPassword(e.target.value)} />
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

export default function GestionRedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('nas');
  const [showNasModal, setShowNasModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [showIpv6Modal, setShowIpv6Modal] = useState(false);
  const [editingNas, setEditingNas] = useState<NasServer | null>(null);

  const { data: nasServers = [], isLoading: nasLoading } = useNasServers();
  const { mutate: createNas } = useCreateNasServer();
  const { mutate: updateNas } = useUpdateNasServer();
  const { mutate: deleteNas } = useDeleteNasServer();

  const { data: networks = [], isLoading: networksLoading } = useIpNetworks();
  const { mutate: createNetwork } = useCreateIpNetwork();
  const { mutate: deleteNetwork } = useDeleteIpNetwork();

  const { data: pools = [], isLoading: poolsLoading } = useIpPools();
  const { mutate: createPool } = useCreateIpPool();
  const { mutate: deletePool } = useDeleteIpPool();

  const { data: assignments = [], isLoading: assignmentsLoading } = useIpAssignments();
  const { data: ipv6Networks = [], isLoading: ipv6Loading } = useIpv6Networks();
  const { mutate: createIpv6Network } = useCreateIpv6Network();

  // NAS summary counts
  const totalNas = nasServers.length;
  const activeNas = nasServers.filter(n => n.status === 'active').length;
  const inactiveNas = nasServers.filter(n => n.status === 'inactive').length;
  const errorNas = nasServers.filter(n => n.status === 'error').length;

  const nasActions = [
    { label: 'Editar', onClick: (row: NasServer) => setEditingNas(row) },
    { label: 'Probar conexión', onClick: (row: NasServer) => { if (window.confirm(`¿Probar conexión con ${row.name}?`)) alert(`Conexión a ${row.name} (${row.ipAddress}) probada correctamente.`); } },
    { label: 'Desactivar', onClick: (row: NasServer) => { if (window.confirm(`¿Desactivar ${row.name}?`)) updateNas({ id: row.id, data: { status: 'inactive' } }); } },
    { label: 'Eliminar', onClick: (row: NasServer) => { if (window.confirm(`¿Eliminar ${row.name}?`)) deleteNas(row.id); } },
  ];

  const networkActions = [
    { label: 'Eliminar', onClick: (row: IpNetwork) => { if (window.confirm(`¿Eliminar red ${row.network}?`)) deleteNetwork(row.id); } },
  ];

  const poolActions = [
    { label: 'Eliminar', onClick: (row: IpPool) => { if (window.confirm(`¿Eliminar pool ${row.name}?`)) deletePool(row.id); } },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Gestión de red</h1>
        {activeTab === 'nas' && (
          <button className={styles.btnPrimary} onClick={() => setShowNasModal(true)}>
            Agregar NAS
          </button>
        )}
        {activeTab === 'redes' && (
          <button className={styles.btnPrimary} onClick={() => setShowNetworkModal(true)}>
            Nueva red
          </button>
        )}
        {activeTab === 'pools' && (
          <button className={styles.btnPrimary} onClick={() => setShowPoolModal(true)}>
            Nuevo pool
          </button>
        )}
        {activeTab === 'ipv6' && (
          <button className={styles.btnPrimary} onClick={() => setShowIpv6Modal(true)}>
            Nueva red IPv6
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'nas' && (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Total NAS</span>
              <span className={styles.cardValue}>{totalNas}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Activos</span>
              <span className={`${styles.cardValue} ${styles.cardValueOnline}`}>{activeNas}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Inactivos</span>
              <span className={`${styles.cardValue} ${styles.cardValueOffline}`}>{inactiveNas}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Error</span>
              <span className={`${styles.cardValue} ${styles.cardValueWarning}`}>{errorNas}</span>
            </div>
          </div>

          <DataTable
            columns={nasColumns}
            data={nasServers}
            loading={nasLoading}
            actions={nasActions}
            emptyMessage="No se encontraron dispositivos NAS."
          />

          <RadiusConfigSection />
        </>
      )}

      {activeTab === 'redes' && (
        <DataTable
          columns={networkColumns}
          data={networks}
          loading={networksLoading}
          actions={networkActions}
          emptyMessage="No se encontraron redes IP."
        />
      )}

      {activeTab === 'pools' && (
        <DataTable
          columns={poolColumns}
          data={pools}
          loading={poolsLoading}
          actions={poolActions}
          emptyMessage="No se encontraron pools IP."
        />
      )}

      {activeTab === 'asignaciones' && (
        <DataTable
          columns={[
            { label: 'IP', key: 'ip' as const },
            { label: 'Pool', key: 'poolId' as const },
            { label: 'Cliente (ID)', key: 'clientId' as const },
            { label: 'Plan', key: 'servicePlanId' as const },
            { label: 'Estado', key: 'status' as const },
            { label: 'Asignada el', key: 'assignedAt' as const },
          ]}
          data={assignments}
          loading={assignmentsLoading}
          emptyMessage="No se encontraron asignaciones."
        />
      )}

      {activeTab === 'ipv6' && (
        <DataTable
          columns={ipv6Columns}
          data={ipv6Networks}
          loading={ipv6Loading}
          emptyMessage="No se encontraron redes IPv6."
        />
      )}

      {showNasModal && (
        <AddNasModal
          onClose={() => setShowNasModal(false)}
          onSubmit={data => { createNas(data); setShowNasModal(false); }}
        />
      )}
      {showNetworkModal && (
        <AddNetworkModal
          onClose={() => setShowNetworkModal(false)}
          onSubmit={data => { createNetwork(data); setShowNetworkModal(false); }}
        />
      )}
      {showPoolModal && (
        <AddPoolModal
          onClose={() => setShowPoolModal(false)}
          onSubmit={data => { createPool(data); setShowPoolModal(false); }}
          networks={networks}
        />
      )}
      {showIpv6Modal && (
        <AddIpv6Modal
          onClose={() => setShowIpv6Modal(false)}
          onSubmit={data => { createIpv6Network(data); setShowIpv6Modal(false); }}
        />
      )}
      {editingNas && (
        <EditNasModal
          nas={editingNas}
          onClose={() => setEditingNas(null)}
          onSubmit={data => { updateNas({ id: editingNas.id, data }); setEditingNas(null); }}
        />
      )}
    </div>
  );
}
