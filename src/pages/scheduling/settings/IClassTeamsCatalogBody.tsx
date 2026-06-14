import { useState } from 'react';
import { useIClassTeams, useSyncIClassTeams } from '@/hooks/useIClassTeams';
import { Can } from '@/components/auth/Can';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { IClassTeamSyncResult } from '@/types/iclassTeam';
import styles from './IClassSettings.module.css';

/**
 * Sub-tab "Cuadrillas" dentro de IClass Settings.
 * Lista el catálogo de cuadrillas sincronizado desde IClass:
 * login / nombre / thirdPartyCode / estado (activo/inactivo) / seleccionable.
 *
 * La sincronización está gateada por `iclass.manage`.
 */
export function IClassTeamsCatalogBody() {
  const { data: teams, isLoading } = useIClassTeams();
  const sync = useSyncIClassTeams();
  const [lastSummary, setLastSummary] = useState<IClassTeamSyncResult | null>(null);

  async function handleSync() {
    try {
      const summary = await sync.mutateAsync();
      setLastSummary(summary);
    } catch {
      // surface via sync.isError
    }
  }

  const items = teams ?? [];

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <p className={styles.helper}>
            Catálogo de cuadrillas sincronizado desde IClass. Solo las cuadrillas <strong>activas y seleccionables</strong> aparecen en el selector de asignación.
          </p>
        </div>
        <div className={styles.toolbarRight}>
          <Can permission="iclass.manage">
            <button
              className={styles.btnPrimary}
              onClick={handleSync}
              disabled={sync.isPending}
            >
              {sync.isPending ? 'Sincronizando…' : 'Sincronizar cuadrillas'}
            </button>
          </Can>
        </div>
      </div>

      {lastSummary && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span>
            <span className={styles.bannerTitle}>Sincronizadas {lastSummary.synced} cuadrillas.</span>
            {' '}
            {lastSummary.created} nuevas · {lastSummary.updated} actualizadas.
          </span>
        </div>
      )}

      {sync.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo sincronizar las cuadrillas.</span>
            {' '}Reintentá en unos segundos.
          </span>
        </div>
      )}

      <div className={styles.tableWrap}>
        {isLoading ? (
          <p className={styles.tableLoading}>Cargando…</p>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>Sin cuadrillas</p>
            <p className={styles.emptyStateText}>
              No hay cuadrillas sincronizadas todavía. Hacé clic en "Sincronizar cuadrillas" para traerlas desde IClass.
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Login</th>
                <th>Nombre</th>
                <th>Código tercero</th>
                <th>Estado</th>
                <th>Seleccionable</th>
                <th>Última sincronización</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.login}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{t.login}</td>
                  <td>{t.name}</td>
                  <td>{t.thirdPartyCode ?? '—'}</td>
                  <td>
                    <span className={`${styles.typeBadge} ${t.active ? styles.typeBadgeActive : styles.typeBadgeInactive}`}>
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.typeBadge} ${t.selectable ? styles.typeBadgeActive : styles.typeBadgeInactive}`}>
                      {t.selectable ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td>{t.lastSyncedAt ? formatDateTimeShort(t.lastSyncedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
