import { useState, useMemo, Fragment, useEffect } from 'react';
import { PppoeManagementTab } from './PppoeManagementTab';
import { Link } from 'react-router-dom';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import { useNasServers, useCreateNasServer, useUpdateNasServer, useDeleteNasServer } from '@/hooks/useNas';
import { useIpNetworks, useCreateIpNetwork, useDeleteIpNetwork, useIpPools, useCreateIpPool, useDeleteIpPool, useIpAssignments, useIpv6Networks, useCreateIpv6Network } from '@/hooks/useNetwork';
import { useRadiusSessions } from '@/hooks/useRadiusSessions';
import { useConfirm } from '@/context/ConfirmContext';
import { Can } from '@/components/auth/Can';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { cutoverStats, nextCutoverType, isRadius } from '@/utils/cutover';
import type { NasServer, NasServerInput, NasType } from '@/types/nas';
import type { IpNetwork, IpPool, IpAssignment, Ipv6Network } from '@/types/network';
import type { RadiusSession } from '@/types/radiusSessions';
import { formatDateTimeShort } from '@/utils/formatDate';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import styles from './GestionRedPage.module.css';

type Tab = 'nas' | 'redes' | 'pools' | 'asignaciones' | 'ipv6' | 'sesiones' | 'pppoe';

const TABS: { key: Tab; label: string }[] = [
  { key: 'nas', label: 'Dispositivos NAS' },
  { key: 'redes', label: 'Redes IP' },
  { key: 'pools', label: 'Pools IP' },
  { key: 'asignaciones', label: 'Asignaciones' },
  { key: 'ipv6', label: 'IPv6' },
  { key: 'sesiones', label: 'Sesiones activas' },
  { key: 'pppoe', label: 'PPPoE' },
];

const NAS_TYPE_LABELS: Record<NasType, string> = {
  mikrotik_api: 'MikroTik API',
  radius_orchestrator: 'RADIUS (orchestrator)',
  cisco: 'Cisco',
  ubiquiti: 'Ubiquiti',
  cambium: 'Cambium',
  other: 'Otro',
};

const NAS_TYPE_COLORS: Record<NasType, string> = {
  mikrotik_api: styles.badgeOrange,
  radius_orchestrator: styles.badgeBlue,
  cisco: styles.badgeBlue,
  ubiquiti: styles.badgeGreen,
  cambium: styles.badgePurple,
  other: styles.badgeGray,
};

// ---------------------------------------------------------------------------
// Inline icons (Lucide-style — no emoji icons, per uipro rules)
// ---------------------------------------------------------------------------
type IcoProps = { className?: string };

const IconPlus = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
);
const IconSearch = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
const IconServer = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M9 16v4" /></svg>
);
const IconNetwork = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
);
const IconPools = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
);
const IconCheck = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
);
const IconCube = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /></svg>
);
// Actividad (señal de sesión en vivo) — usado por el tab "Sesiones activas".
const IconActivity = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
// Plug / PPPoE — tab de gestión global de servicios PPPoE.
const IconPppoe = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v4M17 3v4M7 7h10a2 2 0 0 1 2 2v2a6 6 0 0 1-12 0V9a2 2 0 0 1 2-2z" />
    <path d="M12 15v6M9 21h6" />
  </svg>
);
// Triángulo de advertencia — indicador "sin contrato" (NO emoji, SVG inline).
const IconWarning = ({ className }: IcoProps) => (
  <svg
    className={`${styles.ico} ${className ?? ''}`}
    viewBox="0 0 24 24"
    role="img"
    aria-label="Sin contrato asociado"
  >
    {/* a11y: el nombre accesible viene del aria-label; un <title> sería redundante. */}
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const TAB_ICONS: Record<Tab, ({ className }: IcoProps) => JSX.Element> = {
  nas: IconServer,
  redes: IconNetwork,
  pools: IconPools,
  asignaciones: IconCheck,
  ipv6: IconCube,
  sesiones: IconActivity,
  pppoe: IconPppoe,
};

// ---------------------------------------------------------------------------
// Small presentational atoms
// ---------------------------------------------------------------------------
function NasTypeBadge({ type, displayType }: { type: NasType; displayType?: string }) {
  // El BE puede enviar un label de presentación (ej. "BRAS RADIUS" para un NE8000 sobre RADIUS).
  // Para tipos no-override el BE reenvía el type crudo (ej. "mikrotik_api" === type),
  // así que solo usamos displayType cuando es un override real (distinto del type crudo y no vacío).
  // Si no, derivamos el label lindo de NAS_TYPE_LABELS para no mostrar strings crudos.
  return (
    <span className={`${styles.badge} ${NAS_TYPE_COLORS[type]}`}>
      {displayType && displayType !== type ? displayType : NAS_TYPE_LABELS[type]}
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
  return (
    <span className={`${styles.status} ${cssMap[status]}`}>
      <span className={styles.dot} />
      {labelMap[status]}
    </span>
  );
}

function CutoverPill({ type }: { type: NasType }) {
  return isRadius(type)
    ? <span className={styles.pillRadius}><span className={styles.dot} style={{ background: '#10b981' }} />RADIUS HA</span>
    : <span className={styles.pillLegacy}>legacy</span>;
}

/** "Sin dato" (em dash) para valores que el BE no pudo resolver (null/undefined).
 *  role="img" + aria-label ⇒ el lector de pantalla anuncia "Sin dato", no "raya".
 *  Mantiene `title` como tooltip visual. Mismo patrón que IconWarning. */
function NoData() {
  return (
    <span
      className={styles.muted}
      role="img"
      aria-label="Sin dato"
      title="Sin dato: el RADIUS/router no respondió."
    >
      —
    </span>
  );
}

/** Usage bar with semaphore color: blue &lt;90%, amber ≥90%, red ≥100%.
 *  `used == null` (null O undefined) ⇒ no disponible (el RADIUS/router no
 *  respondió): rendereamos "—" en vez de una barra al 0% — una barra vacía
 *  MENTIRÍA, y `undefined/total` daría NaN%. */
function UsageBar({ used, total }: { used: number | null; total: number }) {
  if (used == null) {
    return <NoData />;
  }
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const over = used > total;
  const barClass = over || pct >= 100 ? styles.barFull : pct >= 90 ? styles.barHot : '';
  const width = Math.min(pct, 100);
  return (
    <div className={styles.usage}>
      <div className={styles.bar}>
        <i className={barClass} style={{ width: `${width}%` }} />
      </div>
      <span className={`${styles.upct} ${over ? styles.upctFull : ''}`}>
        {over ? `+${used - total}` : `${pct}%`}
      </span>
    </div>
  );
}

/** Nota discreta para KPIs agregados que excluyen pools sin dato. Em dash muted,
 *  con `title` explicativo (a11y). No se renderiza si no falta ningún dato. */
function PartialDataNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={styles.muted}
      title={`${count} pool${count === 1 ? '' : 's'} sin dato (el RADIUS/router no respondió); el agregado los excluye.`}
    >
      {' · '}{count} sin dato
    </span>
  );
}

function ActionsMenu<T>({ row, actions }: { row: T; actions: { label: string; onClick: (row: T) => void }[] }) {
  if (actions.length === 0) return null;
  return <KebabMenu items={actions.map(a => ({ label: a.label, onClick: () => a.onClick(row) }))} />;
}

function formatDate(iso: string | null): string {
  return formatDateTimeShort(iso);
}

// ---------------------------------------------------------------------------
// Modals (functionality preserved 1:1)
// ---------------------------------------------------------------------------
interface AddNasModalProps {
  onClose: () => void;
  onSubmit: (data: NasServerInput) => void;
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
                <option value="radius_orchestrator">RADIUS (orchestrator)</option>
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

interface EditNasModalProps {
  nas: NasServer;
  onClose: () => void;
  onSubmit: (data: Partial<NasServerInput>) => void;
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
                <option value="radius_orchestrator">RADIUS (orchestrator)</option>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GestionRedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('nas');
  const [showNasModal, setShowNasModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [showIpv6Modal, setShowIpv6Modal] = useState(false);
  const [editingNas, setEditingNas] = useState<NasServer | null>(null);
  const [query, setQuery] = useState('');

  // ── Asignaciones server-side pagination state ──────────────────────────────
  const [asignPage, setAsignPage] = useState(1);
  const [asignSearchRaw, setAsignSearchRaw] = useState('');
  const [asignNasId, setAsignNasId] = useState('');
  const asignSearch = useDebounce(asignSearchRaw, 300);

  const { data: nasServers = [], isLoading: nasLoading, isError: nasError, refetch: refetchNas } = useNasServers();
  const { mutate: createNas } = useCreateNasServer();
  const { mutate: updateNas } = useUpdateNasServer();
  const { mutate: deleteNas } = useDeleteNasServer();

  const { data: networks = [], isLoading: networksLoading, isError: networksError, refetch: refetchNetworks } = useIpNetworks();
  const { mutate: createNetwork } = useCreateIpNetwork();
  const { mutate: deleteNetwork } = useDeleteIpNetwork();

  const { data: pools = [], isLoading: poolsLoading, isError: poolsError, refetch: refetchPools } = useIpPools();
  const { mutate: createPool } = useCreateIpPool();
  const { mutate: deletePool } = useDeleteIpPool();

  const asignParams = { page: asignPage, pageSize: 25, search: asignSearch || undefined, nasId: asignNasId || undefined };
  const { data: assignmentsPage, isLoading: assignmentsLoading, isFetching: assignmentsFetching, isError: assignmentsError, refetch: refetchAssignments } = useIpAssignments(asignParams);

  const { data: ipv6Networks = [], isLoading: ipv6Loading, isError: ipv6Error, refetch: refetchIpv6 } = useIpv6Networks();
  const { mutate: createIpv6Network } = useCreateIpv6Network();

  const { data: sessions = [], isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useRadiusSessions();

  const confirm = useConfirm();
  const { can } = useMyPermissions();
  const canManage = can('network.manage');
  const cutover = cutoverStats(nasServers);

  // Derived assignment values from paginated response
  const assignments: IpAssignment[] = assignmentsPage?.data ?? [];
  const assignmentsTotal = assignmentsPage?.total ?? 0;
  const assignmentsTotalPages = Math.max(1, Math.ceil(assignmentsTotal / 25));

  // NAS summary counts
  const totalNas = nasServers.length;
  const activeNas = nasServers.filter(n => n.status === 'active').length;
  const inactiveNas = nasServers.filter(n => n.status === 'inactive').length;
  const errorNas = nasServers.filter(n => n.status === 'error').length;

  // Pool / IP aggregates (real data → KPIs).
  // HONESTO: solo agregamos pools CON dato (assignedCount !== null). Un pool sin
  // dato (el RADIUS/router no respondió) NO se cuenta como 0 — eso inflaría las
  // "IPs libres" y bajaría falsamente el "% ocupación". Numerador Y denominador
  // del % se calculan sobre los pools con dato; los sin dato se reportan aparte.
  const totalPools = pools.length;
  const poolsWithData = pools.filter(p => p.assignedCount != null);
  const poolsMissingData = totalPools - poolsWithData.length;
  // hasPoolData=false ⇒ NINGÚN pool tiene dato (outage total / sin pools). Ahí el
  // agregado NO puede mostrar "0% / 0 IPs libres" (mentiría igual que la fila):
  // se rinde "—". Con ≥1 pool con dato, el % y las IPs libres son honestos sobre esos.
  const hasPoolData = poolsWithData.length > 0;
  const poolAssigned = poolsWithData.reduce((s, p) => s + (p.assignedCount ?? 0), 0);
  const poolTotal = poolsWithData.reduce((s, p) => s + p.totalCount, 0);
  const poolFree = Math.max(poolTotal - poolAssigned, 0);
  const occupationPct = poolTotal > 0 ? Math.round((poolAssigned / poolTotal) * 100) : 0;

  // ---- per-tab filtered datasets ------------------------------------------
  const q = query.trim().toLowerCase();

  const filteredNas = useMemo(
    () => (!q ? nasServers : nasServers.filter(n =>
      n.name.toLowerCase().includes(q) || n.ipAddress.toLowerCase().includes(q) || n.nasIpAddress.toLowerCase().includes(q))),
    [nasServers, q],
  );

  const filteredNetworks = useMemo(
    () => (!q ? networks : networks.filter(n =>
      n.network.toLowerCase().includes(q) || n.gateway.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))),
    [networks, q],
  );

  const filteredPools = useMemo(
    () => (!q ? pools : pools.filter(p =>
      p.name.toLowerCase().includes(q) || p.rangeStart.toLowerCase().includes(q) || p.rangeEnd.toLowerCase().includes(q))),
    [pools, q],
  );

  // Pools grouped by NAS/router (prototype: group header + pool rows)
  const nasNameById = useMemo(() => {
    const m = new Map<string, string>();
    nasServers.forEach(n => m.set(n.id, n.name));
    return m;
  }, [nasServers]);

  const poolGroups = useMemo(() => {
    const groups = new Map<string, IpPool[]>();
    filteredPools.forEach(p => {
      const key = p.nasId ?? '__none__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    return [...groups.entries()].map(([nasId, items]) => ({
      nasId,
      label: nasId === '__none__' ? 'Sin router asignado' : (nasNameById.get(nasId) ?? `NAS ${nasId}`),
      items,
    }));
  }, [filteredPools, nasNameById]);

  // Sesiones RADIUS activas agrupadas por nasName (mismo patrón que poolGroups).
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, RadiusSession[]>();
    sessions.forEach(s => {
      const key = s.nasName || 'Sin NAS';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return [...groups.entries()].map(([nasName, items]) => ({ nasName, items }));
  }, [sessions]);

  // ---- actions (functionality preserved) ----------------------------------
  const nasActions = [
    { label: 'Probar conexión', onClick: async (row: NasServer) => { if (await confirm({ message: `¿Probar conexión con ${row.name}?`, confirmLabel: 'Probar' })) alert(`Conexión a ${row.name} (${row.ipAddress}) probada correctamente.`); } },
    ...(canManage ? [
      { label: 'Editar', onClick: (row: NasServer) => setEditingNas(row) },
      { label: 'Cutover ⇄', onClick: async (row: NasServer) => {
        const toRadius = !isRadius(row.type);
        const ok = await confirm({
          message: toRadius
            ? `¿Marcar ${row.name} como RADIUS? Los cortes de este router pasarán a rutearse por el orchestrator (camino RADIUS).`
            : `¿Volver ${row.name} a legacy (MikroTik API directo)? Los cortes volverán al camino MK-directo.`,
          confirmLabel: toRadius ? 'Marcar RADIUS' : 'Volver a legacy',
        });
        if (ok) updateNas({ id: row.id, data: { type: nextCutoverType(row.type) } });
      } },
      { label: 'Desactivar', onClick: async (row: NasServer) => { if (await confirm({ message: `¿Desactivar ${row.name}?`, tone: 'danger', confirmLabel: 'Desactivar' })) updateNas({ id: row.id, data: { status: 'inactive' } }); } },
      { label: 'Eliminar', onClick: async (row: NasServer) => { if (await confirm({ message: `¿Eliminar ${row.name}?`, tone: 'danger', confirmLabel: 'Eliminar' })) deleteNas(row.id); } },
    ] : []),
  ];

  const networkActions = canManage ? [
    { label: 'Eliminar', onClick: async (row: IpNetwork) => { if (await confirm({ message: `¿Eliminar red ${row.network}?`, tone: 'danger', confirmLabel: 'Eliminar' })) deleteNetwork(row.id); } },
  ] : [];

  const poolActions = canManage ? [
    { label: 'Eliminar', onClick: async (row: IpPool) => { if (await confirm({ message: `¿Eliminar pool ${row.name}?`, tone: 'danger', confirmLabel: 'Eliminar' })) deletePool(row.id); } },
  ] : [];

  // tab counts shown in the tabbar badges
  const tabCounts: Record<Tab, number> = {
    nas: nasServers.length,
    redes: networks.length,
    pools: pools.length,
    asignaciones: assignmentsTotal,
    ipv6: ipv6Networks.length,
    sesiones: sessions.length,
    // PPPoE count shown in tab toolbar; 0 here avoids extra BE call on page load.
    pppoe: 0,
  };

  function changeTab(key: Tab) {
    setQuery('');
    setActiveTab(key);
    if (key !== 'asignaciones') {
      setAsignPage(1);
      setAsignSearchRaw('');
      setAsignNasId('');
    }
  }

  const headerCta = (
    <>
      {activeTab === 'nas' && (
        <Can permission="network.manage">
          <button className={styles.btnPrimary} onClick={() => setShowNasModal(true)}>
            <IconPlus />Agregar NAS
          </button>
        </Can>
      )}
      {activeTab === 'redes' && (
        <Can permission="network.manage">
          <button className={styles.btnPrimary} onClick={() => setShowNetworkModal(true)}>
            <IconPlus />Nueva red
          </button>
        </Can>
      )}
      {activeTab === 'pools' && (
        <Can permission="network.manage">
          <button className={styles.btnPrimary} onClick={() => setShowPoolModal(true)}>
            <IconPlus />Nuevo pool
          </button>
        </Can>
      )}
      {activeTab === 'ipv6' && (
        <Can permission="network.manage">
          <button className={styles.btnPrimary} onClick={() => setShowIpv6Modal(true)}>
            <IconPlus />Nueva red IPv6
          </button>
        </Can>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      {/* header */}
      <div className={styles.header}>
        <div className={styles.headTexts}>
          <h1 className={styles.title}>Gestión de red</h1>
          <span className={styles.subtitle}>Dispositivos NAS, redes, pools y asignaciones IP · centralizado en RADIUS</span>
        </div>
        {headerCta}
      </div>

      {/* KPIs — wired to real data */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}><IconServer className={styles.icoSm} />Total NAS</div>
          <div className={styles.kpiValue}>{totalNas}</div>
          <div className={styles.kpiSub}><b>{activeNas}</b> activo{activeNas === 1 ? '' : 's'} · {cutover.legacy} por migrar</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiAmber}`}>
          <div className={styles.kpiLabel}>Migrados a RADIUS</div>
          <span className={styles.kpiBadge}>{cutover.pct}%</span>
          <div className={styles.kpiValue}>
            {cutover.radius}<span className={styles.kpiValueSmall}>/{cutover.total}</span>
          </div>
          <div className={styles.kpiSub}>en HA por el orchestrator</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiGreen}`}>
          <div className={styles.kpiLabel}>Activos</div>
          <div className={styles.kpiValue}>{activeNas}</div>
          <div className={styles.kpiSub}>
            {hasPoolData ? <>{occupationPct}% ocupación de pools</> : <><NoData /> ocupación de pools</>}
            <PartialDataNote count={poolsMissingData} />
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Inactivos</div>
          <div className={styles.kpiValue}>{inactiveNas}</div>
          <div className={styles.kpiSub}>{totalPools} pools · {networks.length} redes</div>
        </div>
        <div className={`${styles.kpi} ${styles.kpiRed}`}>
          <div className={styles.kpiLabel}>Error</div>
          <div className={styles.kpiValue}>{errorNas}</div>
          <div className={styles.kpiSub}>
            {hasPoolData ? <>{poolFree.toLocaleString('es-AR')} IPs libres</> : <><NoData /> IPs libres</>}
            <PartialDataNote count={poolsMissingData} />
          </div>
        </div>
      </div>

      {/* card with tabs */}
      <div className={styles.card}>
        <div className={styles.tabbar}>
          {TABS.map(tab => {
            // El tab PPPoE se ve solo con pppoe.read (las acciones de escritura
            // se gatean aparte con pppoe.manage dentro de PppoeManagementTab).
            if (tab.key === 'pppoe' && !can('pppoe.read')) return null;
            const Icon = TAB_ICONS[tab.key];
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                className={`${styles.tab} ${active ? styles.tabActive : ''}`}
                onClick={() => changeTab(tab.key)}
              >
                <Icon />
                {tab.label}
                {/* F6: no renderizar badge cuando el conteo es 0 o indefinido */}
                {tabCounts[tab.key] > 0 && (
                  <span className={styles.tabCount}>{tabCounts[tab.key]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* NAS */}
        {activeTab === 'nas' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filter}>
                <IconSearch />
                <input
                  placeholder="Filtrar NAS por nombre o IP…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label="Filtrar NAS"
                />
              </div>
              <span className={styles.toolbarRight}>{totalNas} dispositivos · {cutover.radius} en RADIUS</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th><th>Tipo</th><th>IP</th><th>Estado</th>
                    <th className="num">Clientes</th><th>Modo</th><th>Último contacto</th><th />
                  </tr>
                </thead>
                <tbody>
                  {nasError ? (
                    <tr><td colSpan={8}><div className={styles.errorPanel} role="alert">No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchNas()}>Reintentar</button></div></td></tr>
                  ) : nasLoading ? (
                    <tr><td colSpan={8}><div role="status" className={styles.skeleton} aria-label="Cargando…" /></td></tr>
                  ) : filteredNas.length === 0 ? (
                    <tr><td colSpan={8} className={styles.muted}>No se encontraron dispositivos NAS.</td></tr>
                  ) : filteredNas.map(n => (
                    <tr key={n.id} className={styles.bodyRow}>
                      <td className={styles.nm}>{n.name}</td>
                      <td><NasTypeBadge type={n.type} displayType={n.displayType} /></td>
                      <td className={styles.mono}>{n.ipAddress}</td>
                      <td><NasStatusBadge status={n.status} /></td>
                      <td className="num">{n.clientCount}</td>
                      <td><CutoverPill type={n.type} /></td>
                      <td className={`${styles.mono} ${styles.muted}`}>{formatDate(n.lastSeen)}</td>
                      <td className={styles.actionsCell}><ActionsMenu row={n} actions={nasActions} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Redes IP */}
        {activeTab === 'redes' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filter}>
                <IconSearch />
                <input
                  placeholder="Filtrar redes…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label="Filtrar redes"
                />
              </div>
              <span className={styles.toolbarRight}>{networks.length} redes IPv4</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Red (CIDR)</th><th>Gateway</th><th>DNS1</th><th>DNS2</th>
                    <th>Tipo</th><th className="num">IPs usadas / total</th><th />
                  </tr>
                </thead>
                <tbody>
                  {networksError ? (
                    <tr><td colSpan={7}><div className={styles.errorPanel} role="alert">No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchNetworks()}>Reintentar</button></div></td></tr>
                  ) : networksLoading ? (
                    <tr><td colSpan={7}><div role="status" className={styles.skeleton} aria-label="Cargando…" /></td></tr>
                  ) : filteredNetworks.length === 0 ? (
                    <tr><td colSpan={7} className={styles.muted}>No se encontraron redes IP.</td></tr>
                  ) : filteredNetworks.map(net => (
                    <tr key={net.id} className={styles.bodyRow}>
                      <td className={`${styles.nm} ${styles.mono}`}>{net.network}</td>
                      <td className={`${styles.mono} ${styles.muted}`}>{net.gateway}</td>
                      <td className={`${styles.mono} ${styles.muted}`}>{net.dns1}</td>
                      <td className={`${styles.mono} ${styles.muted}`}>{net.dns2}</td>
                      <td><span className={`${styles.badge} ${styles.badgeBlue}`}>{net.type}</span></td>
                      <td className="num">{net.usedIps ?? <NoData />} / {net.totalIps}</td>
                      <td className={styles.actionsCell}><ActionsMenu row={net} actions={networkActions} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pools IP (agrupado por router) */}
        {activeTab === 'pools' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filter}>
                <IconSearch />
                <input
                  placeholder="Filtrar pools por nombre o rango…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label="Filtrar pools"
                />
              </div>
              <span className={styles.toolbarRight}>agrupado por router</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Pool / Rango</th><th>Tipo</th>
                    <th className="num">Asignadas / Total</th><th className="num">Uso</th><th />
                  </tr>
                </thead>
                <tbody>
                  {poolsError ? (
                    <tr><td colSpan={5}><div className={styles.errorPanel} role="alert">No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchPools()}>Reintentar</button></div></td></tr>
                  ) : poolsLoading ? (
                    <tr><td colSpan={5}><div role="status" className={styles.skeleton} aria-label="Cargando…" /></td></tr>
                  ) : filteredPools.length === 0 ? (
                    <tr><td colSpan={5} className={styles.muted}>No se encontraron pools IP.</td></tr>
                  ) : poolGroups.map(group => (
                    <Fragment key={`grp-${group.nasId}`}>
                      <tr className={styles.grp}>
                        <td colSpan={5}>
                          {group.label}
                          <span className={styles.gcount}>{group.items.length} pool{group.items.length === 1 ? '' : 's'}</span>
                        </td>
                      </tr>
                      {group.items.map(p => (
                        <tr key={p.id} className={styles.bodyRow}>
                          <td>
                            <div className={`${styles.nm} ${styles.mono}`}>{p.name}</div>
                            <div className={`${styles.mono} ${styles.sub}`}>{p.rangeStart} – {p.rangeEnd}</div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${p.type === 'dynamic' ? styles.badgeBlue : styles.badgePurple}`}>
                              {p.type === 'dynamic' ? 'Dinámico' : 'Estático'}
                            </span>
                          </td>
                          <td className={`num ${p.assignedCount != null && p.assignedCount > p.totalCount ? styles.redStrong : ''}`}>
                            {p.assignedCount ?? <NoData />} / {p.totalCount}
                          </td>
                          <td className="num"><UsageBar used={p.assignedCount} total={p.totalCount} /></td>
                          <td className={styles.actionsCell}><ActionsMenu row={p} actions={poolActions} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Asignaciones — server-side paginated */}
        {activeTab === 'asignaciones' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filter}>
                <IconSearch />
                <input
                  placeholder="Buscar por cliente, IP o contrato…"
                  value={asignSearchRaw}
                  onChange={e => { setAsignSearchRaw(e.target.value); setAsignPage(1); }}
                  aria-label="Buscar asignaciones"
                />
              </div>
              <select
                className={styles.routerSelect}
                aria-label="Filtrar por router"
                value={asignNasId}
                onChange={e => { setAsignNasId(e.target.value); setAsignPage(1); }}
              >
                <option value="">Todos los routers</option>
                {nasServers.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <span className={styles.toolbarRight}>{assignmentsTotal} asignaciones</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>IP</th><th>Usuario</th><th>Contrato</th>
                    <th>Plan</th><th>Estado</th><th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentsError ? (
                    <tr><td colSpan={6}><div className={styles.errorPanel} role="alert">No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchAssignments()}>Reintentar</button></div></td></tr>
                  ) : (assignmentsLoading || assignmentsFetching) && !assignmentsPage ? (
                    <tr><td colSpan={6}><div role="status" className={styles.skeleton} aria-label="Cargando…" /></td></tr>
                  ) : assignments.length === 0 ? (
                    <tr><td colSpan={6} className={styles.muted}>No se encontraron asignaciones.</td></tr>
                  ) : assignments.map((a: IpAssignment) => (
                    <tr key={a.id} className={styles.bodyRow}>
                      <td className={styles.mono}>{a.ip}</td>
                      <td className={`${styles.mono} ${styles.muted}`}>{a.username}</td>
                      <td className={styles.muted}>{a.contractId}</td>
                      <td className={styles.muted}>{a.profile ?? '—'}</td>
                      <td>
                        <span className={`${styles.status} ${a.status === 'enabled' ? styles.statusOnline : styles.statusOffline}`}>
                          <span className={styles.dot} />{a.status}
                        </span>
                      </td>
                      <td className={`${styles.mono} ${styles.muted}`}>{formatDate(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={asignPage}
              totalPages={assignmentsTotalPages}
              onPageChange={setAsignPage}
            />
          </>
        )}

        {/* IPv6 */}
        {activeTab === 'ipv6' && (() => {
          const filteredIpv6 = !q ? ipv6Networks : ipv6Networks.filter(n =>
            n.network.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
          );
          return (
            <>
              {ipv6Networks.length > 0 && (
                <div className={styles.toolbar}>
                  <div className={styles.filter}>
                    <IconSearch />
                    <input
                      placeholder="Filtrar por red o tipo…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      aria-label="Filtrar IPv6"
                    />
                  </div>
                  <span className={styles.toolbarRight}>{ipv6Networks.length} redes IPv6</span>
                </div>
              )}
              {ipv6Error ? (
                <div className={styles.errorPanel} role="alert">
                  No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchIpv6()}>Reintentar</button>
                </div>
              ) : ipv6Loading ? (
                <div role="status" className={styles.empty}><div className={styles.skeleton} aria-label="Cargando…" /></div>
              ) : ipv6Networks.length === 0 ? (
                <div className={styles.empty}>
                  <IconCube className={styles.emptyIcon} />
                  <h3 className={styles.emptyTitle}>Sin redes IPv6 todavía</h3>
                  <p>Cuando despleguemos IPv6, las redes y delegaciones de prefijo aparecen acá.</p>
                  <Can permission="network.manage">
                    <button className={styles.btnGhost} onClick={() => setShowIpv6Modal(true)}>
                      <IconPlus />Agregar red IPv6
                    </button>
                  </Can>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Red</th><th>Prefijo delegación</th><th>Tipo</th>
                        <th className="num">Usados / Total</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIpv6.map(net => (
                        <tr key={net.id} className={styles.bodyRow}>
                          <td className={`${styles.nm} ${styles.mono}`}>{net.network}</td>
                          <td className={`${styles.mono} ${styles.muted}`}>/{net.delegationPrefix}</td>
                          <td><span className={`${styles.badge} ${styles.badgePurple}`}>{net.type}</span></td>
                          <td className="num">{net.usedPrefixes} / {net.totalPrefixes}</td>
                          <td>
                            <span className={`${styles.status} ${net.status === 'active' ? styles.statusOnline : styles.statusOffline}`}>
                              <span className={styles.dot} />{net.status === 'active' ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}

        {/* PPPoE — gestión global de servicios (tab Phase 6/7) */}
        {activeTab === 'pppoe' && <PppoeManagementTab />}

        {/* Sesiones activas (RADIUS en vivo, agrupadas por NAS) */}
        {activeTab === 'sesiones' && (
          <>
            <div className={styles.toolbar}>
              <span className={styles.toolbarRight}>{sessions.length} sesiones · agrupadas por NAS</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th><th>Usuario PPPoE</th><th>IP</th><th>MAC</th>
                    <th className="num">Descarga</th><th className="num">Carga</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsError ? (
                    <tr><td colSpan={7}><div className={styles.errorPanel} role="alert">No se pudo cargar. <button className={styles.btnRetry} onClick={() => refetchSessions()}>Reintentar</button></div></td></tr>
                  ) : sessionsLoading ? (
                    <tr><td colSpan={7}><div role="status" className={styles.skeleton} aria-label="Cargando…" /></td></tr>
                  ) : sessions.length === 0 ? (
                    <tr><td colSpan={7} className={styles.muted}>No hay sesiones activas.</td></tr>
                  ) : sessionGroups.map(group => (
                    <Fragment key={`sgrp-${group.nasName}`}>
                      <tr className={styles.grp}>
                        <td colSpan={7}>
                          {group.nasName}
                          <span className={styles.gcount}>{group.items.length} sesión{group.items.length === 1 ? '' : 'es'}</span>
                        </td>
                      </tr>
                      {group.items.map(s => (
                        <tr key={s.id} className={styles.bodyRow}>
                          <td className={styles.nm}>
                            <span className={styles.clientCell}>
                              {s.clientId ? (
                                <Link className={styles.clientLink} to={`/admin/customers/view/${s.clientId}`}>
                                  {s.customerName ?? s.clientName ?? '—'}
                                </Link>
                              ) : (
                                <span>{s.customerName ?? s.clientName ?? '—'}</span>
                              )}
                              {s.contractId === null && (
                                <IconWarning className={styles.warnIco} />
                              )}
                            </span>
                          </td>
                          <td className={styles.mono}>{s.username}</td>
                          <td className={styles.mono}>{s.ipAddress}</td>
                          <td className={styles.mono}>{s.macAddress}</td>
                          <td className="num">{s.downloadMbps.toFixed(1)}</td>
                          <td className="num">{s.uploadMbps.toFixed(1)}</td>
                          <td>
                            <span className={`${styles.status} ${s.status === 'active' ? styles.statusOnline : styles.statusOffline}`}>
                              <span className={styles.dot} />{s.status === 'active' ? 'Activo' : 'Idle'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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
