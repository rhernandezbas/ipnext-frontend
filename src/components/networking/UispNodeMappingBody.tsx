import { useState, useMemo, useCallback } from 'react';
import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { iclassReadiness } from '@/utils/iclassReadiness';
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
 * Calcado de IClassProjectMappingBody.
 */
export function UispNodeMappingBody() {
  const { data: sites, isLoading: sitesLoading } = useNetworkSites();
  const { data: uispData } = useUispSites();
  const patch = usePatchNetworkSite();

  const [search, setSearch] = useState('');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  // Local draft values for the iclassNodeCode input, keyed by siteId.
  // Initialized lazily on first edit; falls back to site.iclassNodeCode ?? ''.
  const [codeDraft, setCodeDraft] = useState<Record<string, string>>({});

  const uispSites = uispData?.sites ?? [];

  const visible = useMemo(() => {
    const all = sites ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(s => s.name.toLowerCase().includes(q));
  }, [sites, search]);

  async function handleChange(siteId: string, rawValue: string) {
    const uispSiteId = rawValue === '' ? null : rawValue;
    setRowStatus(s => ({ ...s, [siteId]: 'saving' }));
    try {
      await patch.mutateAsync({ id: siteId, data: { uispSiteId } });
      setRowStatus(s => ({ ...s, [siteId]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[siteId];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [siteId]: 'error' }));
    }
  }

  const handleCodeSave = useCallback(async (siteId: string, draft: string, original: string | null) => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : trimmed;
    const prev = original ?? null;
    // Only save if value actually changed
    if (next === prev) return;
    setRowStatus(s => ({ ...s, [siteId]: 'saving' }));
    try {
      await patch.mutateAsync({ id: siteId, data: { iclassNodeCode: next } });
      setRowStatus(s => ({ ...s, [siteId]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[siteId];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [siteId]: 'error' }));
    }
  }, [patch]);

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
      </div>

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
                const currentValue = site.uispSiteId ?? '';
                const readiness = iclassReadiness(site);
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
                      <input
                        data-testid={`iclass-code-input-${site.id}`}
                        type="text"
                        className={styles.codeInput}
                        value={codeDraft[site.id] ?? (site.iclassNodeCode ?? '')}
                        placeholder="—"
                        disabled={status === 'saving'}
                        aria-label={`Código IClass para ${site.name}`}
                        onChange={e => setCodeDraft(d => ({ ...d, [site.id]: e.target.value }))}
                        onBlur={() => handleCodeSave(
                          site.id,
                          codeDraft[site.id] ?? (site.iclassNodeCode ?? ''),
                          site.iclassNodeCode,
                        )}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                            handleCodeSave(
                              site.id,
                              codeDraft[site.id] ?? (site.iclassNodeCode ?? ''),
                              site.iclassNodeCode,
                            );
                          }
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className={`${styles.select} ${currentValue === '' ? styles.selectUnmapped : ''}`}
                        value={currentValue}
                        onChange={e => handleChange(site.id, e.target.value)}
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
