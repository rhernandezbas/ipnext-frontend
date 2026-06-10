import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUispSites } from '@/hooks/useUispSites';
import { useUispSyncStatus, useTriggerUispSync } from '@/hooks/useUispSyncStatus';
import { Can } from '@/components/auth/Can';
import { formatSyncDate } from '@/lib/uisp';
import type { UispSiteRow } from '@/types/uisp';
import styles from './NodesPage.module.css';

// ── Status badge ────────────────────────────────────────────────────────────

function SiteStatusBadge({ status }: { status: string }) {
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

// ── Empty states ────────────────────────────────────────────────────────────

function NotConfiguredEmptyState() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>UISP no configurado</p>
      <p className={styles.emptyText}>
        Configurá las variables de entorno <code>UISP_BASE_URL</code> y <code>UISP_TOKEN</code> para
        habilitar la integración con UISP.
      </p>
    </div>
  );
}

function NeverSyncedEmptyState() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>La sincronización nunca fue ejecutada</p>
      <p className={styles.emptyText}>
        Activá el flag <strong>uisp-sync</strong> y ejecutá el primer sync desde la configuración
        de integraciones.
      </p>
    </div>
  );
}

// ── Site row ────────────────────────────────────────────────────────────────

function SiteRow({ site }: { site: UispSiteRow }) {
  return (
    <tr>
      <td className={styles.nameCell}>
        <Link to={`/admin/networking/nodes/${site.uispId}`} className={styles.siteLink}>
          {site.name}
        </Link>
        {site.missingSince && (
          <span className={styles.missingBadge} title={`No visto desde ${site.missingSince}`}>
            no visto
          </span>
        )}
      </td>
      <td><SiteStatusBadge status={site.status} /></td>
      <td>{site.deviceCount}</td>
      <td>{site.outageCount}</td>
      <td>{formatSyncDate(site.lastSyncAt)}</td>
    </tr>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function NodesPage() {
  const [search, setSearch] = useState('');
  const { data: sitesData, isLoading: sitesLoading } = useUispSites();
  const { data: syncStatus } = useUispSyncStatus();
  const triggerSync = useTriggerUispSync();

  const sites = sitesData?.sites ?? [];

  const filtered = search.trim()
    ? sites.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    : sites;

  function handleSync() {
    triggerSync.mutate(undefined as never);
  }

  // ── Determine empty state ─────────────────────────────────────────────
  function renderContent() {
    if (sitesLoading) {
      return (
        <tr>
          <td colSpan={5} className={styles.loadingCell}>Cargando…</td>
        </tr>
      );
    }

    if (syncStatus && !syncStatus.configured) {
      return (
        <tr>
          <td colSpan={5}>
            <NotConfiguredEmptyState />
          </td>
        </tr>
      );
    }

    if (syncStatus && syncStatus.configured && syncStatus.lastRunAt === null) {
      return (
        <tr>
          <td colSpan={5}>
            <NeverSyncedEmptyState />
          </td>
        </tr>
      );
    }

    if (filtered.length === 0) {
      return (
        <tr>
          <td colSpan={5} className={styles.emptyCell}>
            {search ? 'Sin resultados para la búsqueda.' : 'No hay nodos registrados.'}
          </td>
        </tr>
      );
    }

    return filtered.map((site) => <SiteRow key={site.uispId} site={site} />);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Nodos UISP</h1>
          {syncStatus && (
            <span className={styles.syncMeta}>
              Última sync: {formatSyncDate(syncStatus.lastRunAt)}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar nodo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar nodo"
          />
          <Can permission="uisp.manage">
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSync}
              disabled={triggerSync.isPending}
              aria-label="Sincronizar ahora"
            >
              {triggerSync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </Can>
        </div>
      </div>

      {triggerSync.isSuccess && triggerSync.data && !triggerSync.data.queued && (
        <div className={styles.banner}>
          {triggerSync.data.reason === 'already-running'
            ? 'El sync ya está en ejecución, esperá que termine.'
            : 'El sync está desactivado. Activá el flag uisp-sync para ejecutarlo.'}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Equipos</th>
              <th>Interrupciones</th>
              <th>Último sync</th>
            </tr>
          </thead>
          <tbody>
            {renderContent()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
