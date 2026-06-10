import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useNetworkSites, useCreateNetworkSite, useUpdateNetworkSite, useDeleteNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import type { NetworkSite, NetworkSiteUispInfo } from '@/types/networkSite';
import { Can } from '@/components/auth/Can';
import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { iclassReadiness } from '@/utils/iclassReadiness';
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
  const [iclassNodeCode, setIclassNodeCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, address, city, type, uplink, description,
      coordinates: null,
      status: 'active',
      deviceCount: 0,
      clientCount: 0,
      parentSiteId: null,
      iclassNodeCode: iclassNodeCode.trim() || null,
      uispSiteId: null,
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
          <div className={styles.formGroup}>
            <label htmlFor="site-iclass-node-code">Código IClass</label>
            <input
              id="site-iclass-node-code"
              type="text"
              value={iclassNodeCode}
              onChange={e => setIclassNodeCode(e.target.value)}
              placeholder="Ej: NODO-C-01"
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

interface EditSiteModalProps {
  site: NetworkSite;
  onClose: () => void;
  onSubmit: (data: Partial<NetworkSite>) => void;
  /** 422 error from the update mutation, if any */
  updateError?: { isAxiosError?: boolean; response?: { status: number; data?: { code?: string } } } | null;
}

function EditSiteModal({ site, onClose, onSubmit, updateError }: EditSiteModalProps) {
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address);
  const [city, setCity] = useState(site.city);
  const [type, setType] = useState<NetworkSite['type']>(site.type);
  const [uplink, setUplink] = useState(site.uplink);
  const [description, setDescription] = useState(site.description);
  const [status, setStatus] = useState<NetworkSite['status']>(site.status);
  const [iclassNodeCode, setIclassNodeCode] = useState(site.iclassNodeCode ?? '');
  const [uispSiteId, setUispSiteId] = useState(site.uispSiteId ?? '');

  const { data: uispData } = useUispSites();
  const uispSites = uispData?.sites ?? [];

  // Check if the error is a 422 UISP_SITE_NOT_FOUND
  const isUispError =
    updateError?.isAxiosError &&
    updateError.response?.status === 422 &&
    updateError.response?.data?.code === 'UISP_SITE_NOT_FOUND';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, address, city, type, uplink, description, status,
      iclassNodeCode: iclassNodeCode.trim() || null,
      uispSiteId: uispSiteId || null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar sitio</h2>
        {isUispError && (
          <div className={styles.errorBanner} role="alert">
            El nodo UISP seleccionado no existe en el mirror. Sincronizá primero o verificá el ID.
          </div>
        )}
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
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-iclass-node-code">Código IClass</label>
            <input
              id="edit-site-iclass-node-code"
              type="text"
              value={iclassNodeCode}
              onChange={e => setIclassNodeCode(e.target.value)}
              placeholder="Ej: NODO-C-01"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-site-uisp-site">Nodo UISP (opcional)</label>
            <select
              id="edit-site-uisp-site"
              value={uispSiteId}
              onChange={e => setUispSiteId(e.target.value)}
            >
              <option value="">— Sin vincular —</option>
              {uispSites.map(s => (
                <option key={s.uispId} value={s.uispId}>{s.name}</option>
              ))}
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

// ── UISP-derived column helpers ─────────────────────────────────────────────

function UispStatusCell({ uisp, siteId }: { uisp: NetworkSiteUispInfo | null | undefined; siteId: string }) {
  if (!uisp) {
    return <span data-testid={`uisp-status-${siteId}`}>—</span>;
  }
  const cssMap: Record<string, string> = {
    active: styles.uispBadgeActive,
    inactive: styles.uispBadgeInactive,
    unknown: styles.uispBadgeUnknown,
  };
  const labelMap: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    unknown: 'Desconocido',
  };
  const cls = cssMap[uisp.status] ?? styles.uispBadgeUnknown;
  const label = labelMap[uisp.status] ?? uisp.status;
  return (
    <span data-testid={`uisp-status-${siteId}`} className={`${styles.uispBadge} ${cls}`}>
      {label}
    </span>
  );
}

function UispDevicesCell({ uisp, siteId }: { uisp: NetworkSiteUispInfo | null | undefined; siteId: string }) {
  if (!uisp) {
    return <span data-testid={`uisp-devices-${siteId}`}>—</span>;
  }
  return (
    <span data-testid={`uisp-devices-${siteId}`}>
      {uisp.deviceCount}
      {uisp.missingSince && (
        <span
          data-testid={`uisp-missing-${siteId}`}
          className={`${styles.uispBadge} ${styles.uispBadgeMissing}`}
          style={{ marginLeft: '0.4rem' }}
        >
          no visto
        </span>
      )}
    </span>
  );
}

function IClassReadinessBadge({ site }: { site: NetworkSite }) {
  const { ready, missing } = iclassReadiness(site);
  if (ready) return null;
  return (
    <span
      data-testid={`iclass-readiness-${site.id}`}
      className={styles.iclassBadge}
      title={`Faltan: ${missing.join(', ')}`}
    >
      Faltan datos IClass
    </span>
  );
}

const columns = [
  {
    label: 'Nombre',
    key: 'name' as keyof NetworkSite,
    render: (row: NetworkSite) => (
      <span>
        {row.name}
        <IClassReadinessBadge site={row} />
      </span>
    ),
  },
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
  {
    label: 'Estado UISP',
    key: 'uisp' as keyof NetworkSite,
    render: (row: NetworkSite) => <UispStatusCell uisp={row.uisp} siteId={row.id} />,
  },
  {
    label: 'Equipos UISP',
    key: 'uisp' as keyof NetworkSite,
    render: (row: NetworkSite) => <UispDevicesCell uisp={row.uisp} siteId={row.id} />,
  },
  {
    label: 'Nodo UISP',
    key: 'uispSiteId' as keyof NetworkSite,
    render: (row: NetworkSite) =>
      row.uispSiteId ? (
        <Link
          to={`/admin/networking/nodes/${row.uispSiteId}`}
          className={styles.uispLink}
        >
          Ver nodo UISP
        </Link>
      ) : (
        <span data-testid={`uisp-link-${row.id}`}>—</span>
      ),
  },
];

export default function NetworkSitesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<NetworkSite | null>(null);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const { data: sites = [], isLoading } = useNetworkSites();
  const { mutate: createSite } = useCreateNetworkSite();
  const { mutate: updateSite, isError: updateIsError, error: updateError } = useUpdateNetworkSite();
  const { mutate: deleteSite } = useDeleteNetworkSite();
  const canManageSites = useCan('network.manage_sites');
  const confirm = useConfirm();

  const total = sites.length;
  const active = sites.filter((s) => s.status === 'active').length;
  const maintenance = sites.filter((s) => s.status === 'maintenance').length;

  const visibleSites = useMemo(
    () => onlyIncomplete ? sites.filter(s => !iclassReadiness(s).ready) : sites,
    [sites, onlyIncomplete],
  );

  async function handleDelete(row: NetworkSite) {
    if (await confirm({ message: `¿Eliminar sitio "${row.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' })) {
      deleteSite(row.id);
    }
  }

  const actions = canManageSites
    ? [
        { label: 'Editar', onClick: (row: NetworkSite) => setEditingSite(row) },
        { label: 'Eliminar', onClick: handleDelete },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sitios de red</h1>
        <Can permission="network.manage_sites">
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            Nuevo sitio
          </button>
        </Can>
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

      <div className={styles.filterRow}>
        <label className={styles.incompleteFilterLabel}>
          <input
            type="checkbox"
            checked={onlyIncomplete}
            onChange={e => setOnlyIncomplete(e.target.checked)}
            aria-label="Solo incompletos"
          />
          Solo incompletos
        </label>
      </div>

      <DataTable
        columns={columns}
        data={visibleSites}
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
          onSubmit={data => {
            updateSite(
              { id: editingSite.id, data },
              { onSuccess: () => setEditingSite(null) },
            );
          }}
          updateError={updateIsError ? (updateError as EditSiteModalProps['updateError']) : null}
        />
      )}
    </div>
  );
}
