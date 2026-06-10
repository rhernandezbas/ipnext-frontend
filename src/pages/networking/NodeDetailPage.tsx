import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUispSiteDetail } from '@/hooks/useUispSiteDetail';
import { categorizeSignal, humanizeUptime, formatSyncDate } from '@/lib/uisp';
import type { UispDeviceRow } from '@/types/uisp';
import type { SignalTier } from '@/lib/uisp';
import styles from './NodeDetailPage.module.css';

// ── Signal semaphore ────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<SignalTier, string> = {
  excellent: 'Excelente',
  good: 'Buena',
  fair: 'Regular',
  critical: 'Crítica',
  none: '—',
};

function SignalBadge({ signal }: { signal: number | null }) {
  const tier = categorizeSignal(signal);
  const cssMap: Record<SignalTier, string> = {
    excellent: styles.signalExcellent,
    good: styles.signalGood,
    fair: styles.signalFair,
    critical: styles.signalCritical,
    none: styles.signalNone,
  };
  return (
    <span className={`${styles.signalBadge} ${cssMap[tier]}`}>
      {signal !== null ? `${signal} dBm` : '—'}
      <span className={styles.signalTier}>{SIGNAL_LABELS[tier]}</span>
    </span>
  );
}

// ── Device status badge ─────────────────────────────────────────────────────

function DeviceStatusBadge({ status }: { status: string }) {
  const cssMap: Record<string, string> = {
    active: styles.statusActive,
    inactive: styles.statusInactive,
    unknown: styles.statusUnknown,
  };
  const labelMap: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    unknown: 'Desconocido',
  };
  const cls = cssMap[status] ?? styles.statusUnknown;
  const label = labelMap[status] ?? status;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Device row ──────────────────────────────────────────────────────────────

function DeviceRow({ device }: { device: UispDeviceRow }) {
  return (
    <tr>
      <td className={styles.nameCell}>
        <span className={styles.deviceName}>{device.name}</span>
        {device.missingSince && (
          <span className={styles.missingBadge}>no visto</span>
        )}
      </td>
      <td>{device.model}{device.modelName ? ` — ${device.modelName}` : ''}</td>
      <td>{device.type ?? '—'}</td>
      <td><DeviceStatusBadge status={device.status} /></td>
      <td><SignalBadge signal={device.signal} /></td>
      <td>{humanizeUptime(device.uptime)}</td>
      <td>{device.ip ?? '—'}</td>
    </tr>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function NodeDetailPage() {
  const { uispId } = useParams<{ uispId: string }>();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useUispSiteDetail(uispId ?? '');

  if (isLoading) {
    return <div className={styles.page}><p className={styles.loadingText}>Cargando…</p></div>;
  }

  if (isError || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>No se pudo cargar el nodo. Verificá que la URL sea correcta.</p>
        <Link to="/admin/networking/nodes" className={styles.backLink}>← Volver a Nodos</Link>
      </div>
    );
  }

  const { site, devices } = data;

  const filteredDevices = search.trim()
    ? devices.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.ip ?? '').includes(search)
      )
    : devices;

  return (
    <div className={styles.page}>
      {/* ── Back link ─────────────────────────────────────────────────── */}
      <Link to="/admin/networking/nodes" className={styles.backLink}>
        ← Nodos
      </Link>

      {/* ── Site header ───────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{site.name}</h1>
          <span className={`${styles.badge} ${site.status === 'active' ? styles.statusActive : styles.statusUnknown}`}>
            {site.status === 'active' ? 'Activo' : site.status === 'inactive' ? 'Inactivo' : 'Desconocido'}
          </span>
          {site.missingSince && (
            <span className={styles.missingBadge}>no visto</span>
          )}
        </div>

        <dl className={styles.metaGrid}>
          {site.parentUispId && (
            <>
              <dt>Parent</dt>
              <dd>{site.parentUispId}</dd>
            </>
          )}
          {(site.latitude !== null && site.longitude !== null) && (
            <>
              <dt>Coords</dt>
              <dd>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</dd>
            </>
          )}
          {site.contact && (
            <>
              <dt>Contacto</dt>
              <dd>{site.contact}</dd>
            </>
          )}
          <dt>Equipos</dt>
          <dd>{site.deviceCount}</dd>
          <dt>Interrupciones</dt>
          <dd>{site.outageCount}</dd>
          <dt>Último sync</dt>
          <dd>{formatSyncDate(site.lastSyncAt)}</dd>
          {site.linkedNetworkSite && (
            <>
              <dt>NetworkSite</dt>
              <dd>
                <Link
                  to="/admin/networking/sites"
                  className={styles.networkSiteLink}
                  title={`Ver NetworkSite: ${site.linkedNetworkSite.name}`}
                >
                  {site.linkedNetworkSite.name}
                </Link>
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* ── Devices table ─────────────────────────────────────────────── */}
      <div className={styles.tableSection}>
        <div className={styles.tableToolbar}>
          <h2 className={styles.tableTitle}>Equipos ({devices.length})</h2>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar equipo o IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar equipo"
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modelo</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Señal</th>
                <th>Uptime</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    {search ? 'Sin resultados para la búsqueda.' : 'Sin equipos registrados.'}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((d) => <DeviceRow key={d.uispId} device={d} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
