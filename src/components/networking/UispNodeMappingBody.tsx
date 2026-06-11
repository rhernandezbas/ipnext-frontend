import { useState, useMemo } from 'react';
import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { useIClassNodes, useSyncIClassNodes } from '@/hooks/useIClassNodes';
import { iclassReadiness } from '@/utils/iclassReadiness';
import type { IClassNode, IClassNodeSyncResult } from '@/types/iclassNode';
import styles from './UispNodeMappingBody.module.css';

type RowStatus = 'saving' | 'saved' | 'error';

// ── Status badge ─────────────────────────────────────────────────────────────

function UispStatusBadge({ status }: { status: string }) {
  const cssMap: Record<string, string> = {
    active:   styles.statusActive,
    inactive: styles.statusInactive,
    unknown:  styles.statusUnknown,
  };
  const labelMap: Record<string, string> = {
    active:   'Activo',
    inactive: 'Inactivo',
    unknown:  'Desconocido',
  };
  const cls = cssMap[status] ?? styles.statusUnknown;
  const label = labelMap[status] ?? status;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── UispNodeMappingBody ───────────────────────────────────────────────────────

/**
 * Catálogo de mapeo NetworkSite ↔ nodo UISP.
 * Patrón: tabla + select por fila + auto-save + estados por fila saving/saved/error.
 * La columna "Código IClass" es un <select> validado contra el catálogo de nodos
 * IClass (active && selectable). Un valor legacy free-text que no matchea ningún
 * `code` se muestra como opción deshabilitada "{code} (sin validar)".
 */
export function UispNodeMappingBody() {
  const { data: sites, isLoading: sitesLoading } = useNetworkSites();
  const { data: uispData } = useUispSites();
  const { data: nodes } = useIClassNodes();
  const patch = usePatchNetworkSite();
  const sync = useSyncIClassNodes();

  const [search, setSearch] = useState('');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [syncResult, setSyncResult] = useState<IClassNodeSyncResult | null>(null);

  const uispSites = uispData?.sites ?? [];
  // Full catalog (incl. inactive / non-selectable nodes) — used for code matching so a
  // deactivated node still resolves (M1). The dropdown only offers the eligible subset.
  const catalog = useMemo<IClassNode[]>(() => nodes ?? [], [nodes]);
  const eligible = useMemo(
    () => catalog.filter(n => n.active && n.selectable),
    [catalog],
  );

  // code → catalog node (for preselecting a site's legacy iclassNodeCode by uuid).
  // Matches against the FULL catalog so an inactive node is recognized, not treated
  // as unknown free-text.
  const nodeByCode = useMemo(() => {
    const m = new Map<string, IClassNode>();
    for (const n of catalog) m.set(n.code, n);
    return m;
  }, [catalog]);

  const visible = useMemo(() => {
    const all = sites ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(s => s.name.toLowerCase().includes(q));
  }, [sites, search]);

  function flashStatus(siteId: string, status: RowStatus) {
    setRowStatus(s => ({ ...s, [siteId]: status }));
    if (status === 'saved') {
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[siteId];
          return copy;
        });
      }, 2000);
    }
  }

  async function handleUispChange(siteId: string, rawValue: string) {
    const uispSiteId = rawValue === '' ? null : rawValue;
    flashStatus(siteId, 'saving');
    try {
      await patch.mutateAsync({ id: siteId, data: { uispSiteId } });
      flashStatus(siteId, 'saved');
    } catch {
      flashStatus(siteId, 'error');
    }
  }

  async function handleNodeChange(siteId: string, rawValue: string) {
    const iclassNodeId = rawValue === '' ? null : rawValue;
    flashStatus(siteId, 'saving');
    try {
      await patch.mutateAsync({ id: siteId, data: { iclassNodeId } });
      flashStatus(siteId, 'saved');
    } catch {
      flashStatus(siteId, 'error');
    }
  }

  async function handleSync() {
    try {
      const result = await sync.mutateAsync();
      setSyncResult(result);
    } catch {
      // surfaced via sync.isError banner below
    }
  }

  if (sitesLoading) {
    return (
      <div className={styles.tableWrap}>
        <p className={styles.tableLoading}>Cargando…</p>
      </div>
    );
  }

  const allSites = sites ?? [];

  if (allSites.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No hay network sites</p>
          <p className={styles.emptyStateText}>
            Todavía no hay sitios de red registrados. Creá el primer network site para poder
            vincularlo a un nodo de UISP.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar network site…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Buscar network site"
        />
        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.syncButton}
            onClick={handleSync}
            disabled={sync.isPending}
          >
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar desde IClass'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          <span className={styles.bannerTitle}>Sincronizados {syncResult.synced} nodos.</span>
          {' '}
          {syncResult.created} nuevos · {syncResult.updated} actualizados · {syncResult.reactivated} reactivados · {syncResult.deactivated} desactivados.
        </div>
      )}

      {sync.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span className={styles.bannerTitle}>No se pudo sincronizar el catálogo.</span> Reintentá en unos segundos.
        </div>
      )}

      {visible.length === 0 && search ? (
        <div className={styles.tableWrap}>
          <p className={styles.tableEmpty}>Sin resultados para la búsqueda.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Network site</th>
                <th>Código IClass</th>
                <th>Nodo UISP</th>
                <th>Estado</th>
                <th style={{ width: '3rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(site => {
                const status = rowStatus[site.id];
                const currentUisp = site.uispSiteId ?? '';
                const readiness = iclassReadiness(site);

                const code = site.iclassNodeCode;
                const matched = code ? nodeByCode.get(code) : undefined;
                // A match is "eligible" only if it is active && selectable — i.e. a real
                // option in the dropdown. An inactive/non-selectable match is recognized
                // (not unknown) but cannot be picked.
                const matchedEligible = !!matched && matched.active && matched.selectable;
                // value: eligible node uuid, else the legacy sentinel, or '' (unassigned)
                const legacyValue = code ? `__legacy__:${code}` : '';
                const nodeValue = matchedEligible ? matched!.id : legacyValue;
                // No catalog match at all → truly unknown free-text → "(sin validar)".
                const isUnvalidated = !!code && !matched;
                // Matched a node that is no longer eligible (deactivated / grouping) →
                // distinct "(inactivo en IClass)" disabled option (M1).
                const isInactiveMatch = !!matched && !matchedEligible;

                return (
                  <tr key={site.id}>
                    <td className={styles.nameCell}>
                      <span className={styles.siteName}>{site.name}</span>
                      {!readiness.ready && (
                        <span
                          data-testid={`iclass-readiness-${site.id}`}
                          className={styles.iclassBadge}
                          title={`Faltan: ${readiness.missing.join(', ')}`}
                        >
                          Faltan datos IClass
                        </span>
                      )}
                    </td>
                    <td className={styles.codeCell}>
                      <select
                        data-testid={`iclass-node-select-${site.id}`}
                        className={`${styles.select} ${nodeValue === '' ? styles.selectUnmapped : ''}`}
                        value={nodeValue}
                        disabled={status === 'saving'}
                        aria-label={`Código IClass para ${site.name}`}
                        onChange={e => handleNodeChange(site.id, e.target.value)}
                      >
                        <option value="">— Sin asignar —</option>
                        {isUnvalidated && (
                          <option value={legacyValue} disabled>
                            {code} (sin validar)
                          </option>
                        )}
                        {isInactiveMatch && (
                          <option value={legacyValue} disabled>
                            {code} (inactivo en IClass)
                          </option>
                        )}
                        {eligible.map(n => (
                          <option key={n.id} value={n.id}>{n.code}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`${styles.select} ${currentUisp === '' ? styles.selectUnmapped : ''}`}
                        value={currentUisp}
                        onChange={e => handleUispChange(site.id, e.target.value)}
                        disabled={status === 'saving'}
                        aria-label={`Nodo UISP para ${site.name}`}
                      >
                        <option value="">— Sin vincular —</option>
                        {uispSites.map(u => (
                          <option key={u.uispId} value={u.uispId}>{u.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span data-testid={`uisp-node-status-${site.id}`}>
                        {site.uisp ? (
                          <UispStatusBadge status={site.uisp.status} />
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td>
                      {status === 'saving' && (
                        <span className={`${styles.rowStatus} ${styles.rowStatusSaving}`} aria-label="Guardando">⏳</span>
                      )}
                      {status === 'saved' && (
                        <span className={`${styles.rowStatus} ${styles.rowStatusSaved}`} aria-label="Guardado">✓</span>
                      )}
                      {status === 'error' && (
                        <span className={`${styles.rowStatus} ${styles.rowStatusError}`} aria-label="Error" title="No se pudo guardar">⚠</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
