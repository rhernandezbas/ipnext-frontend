import { useState } from 'react';
import { useIClassSoTypes, useSyncIClassSoTypes } from '@/hooks/useIClassSoTypes';
import type { IClassSoTypeSyncResult } from '@/types/iclassSoType';
import styles from './IClassSettings.module.css';

/**
 * Sub-tab "Catálogo" — read-only del catálogo de IClass SO types.
 * Permite re-sincronizar contra IClass; el contenido se edita en el panel
 * IClass, no acá. Filtros y badges siguen el design system del proyecto.
 */
export function IClassSoTypesCatalogBody() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: types, isLoading } = useIClassSoTypes(includeInactive ? undefined : true);
  const sync = useSyncIClassSoTypes();
  const [lastSummary, setLastSummary] = useState<IClassSoTypeSyncResult | null>(null);

  async function handleSync() {
    try {
      const summary = await sync.mutateAsync();
      setLastSummary(summary);
    } catch {
      // surface via sync.isError banner below
    }
  }

  const items = types ?? [];

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <label className={styles.segmented} aria-label="Filtro de tipos">
            <span className={styles.segmentedItem}>
              <input
                type="radio"
                name="catalog-filter"
                checked={!includeInactive}
                onChange={() => setIncludeInactive(false)}
              />
              Solo activos
            </span>
            <span className={styles.segmentedItem}>
              <input
                type="radio"
                name="catalog-filter"
                checked={includeInactive}
                onChange={() => setIncludeInactive(true)}
                aria-label="Mostrar inactivos también"
              />
              Todos
            </span>
          </label>
        </div>
        <div className={styles.toolbarRight}>
          <button
            className={styles.btnPrimary}
            onClick={handleSync}
            disabled={sync.isPending}
          >
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      <p className={styles.helper}>
        Catálogo sincronizado desde IClass. Para crear o modificar tipos, hacelo en el panel IClass y luego sincronizá acá.
      </p>

      {lastSummary && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span>
            <span className={styles.bannerTitle}>Sincronizados {lastSummary.synced} tipos.</span>
            {' '}
            {lastSummary.created} nuevos · {lastSummary.updated} actualizados · {lastSummary.reactivated} reactivados · {lastSummary.deactivated} desactivados.
          </span>
        </div>
      )}

      {sync.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo sincronizar el catálogo.</span> Reintentá en unos segundos.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        {isLoading ? (
          <p className={styles.tableLoading}>Cargando…</p>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>Catálogo vacío</p>
            <p className={styles.emptyStateText}>
              No hay tipos de OS sincronizados todavía. Hacé click en "Sincronizar ahora" para traerlos desde IClass.
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Última sincronización</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id}>
                  <td>{t.code}</td>
                  <td>{t.description || '—'}</td>
                  <td>
                    <span className={`${styles.typeBadge} ${t.active ? styles.typeBadgeActive : styles.typeBadgeInactive}`}>
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleString('es-AR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
