import { useState } from 'react';
import { useIClassSoTypes, useSyncIClassSoTypes } from '@/hooks/useIClassSoTypes';
import type { IClassSoTypeSyncResult } from '@/types/iclassSoType';
import styles from '../SchedulingTaskCategoriesPage.module.css';

/**
 * Sub-tab "Catálogo" — read-only del catálogo de IClass SO types.
 * Permite re-sincronizar contra IClass; el contenido se edita en el panel IClass,
 * no acá.
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
      // error UI ya cubierto por sync.isError abajo
    }
  }

  const items = types ?? [];

  return (
    <>
      <div className={styles.toolbar}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={e => setIncludeInactive(e.target.checked)}
          />
          Mostrar inactivos también
        </label>
        <button
          className={styles.btnPrimary}
          onClick={handleSync}
          disabled={sync.isPending}
        >
          {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      </div>

      <p className={styles.empty} style={{ textAlign: 'left', fontSize: '0.875rem', padding: '0.5rem 0' }}>
        Catálogo sincronizado desde IClass. Para crear o modificar tipos, hacelo en el panel IClass y luego sincronizá acá.
      </p>

      {lastSummary && (
        <div className={styles.card} style={{ background: 'var(--color-success-bg, #e6f6e6)', marginBottom: '0.75rem' }}>
          Sincronizados {lastSummary.synced} tipos: {lastSummary.created} nuevos, {lastSummary.updated} actualizados, {lastSummary.reactivated} reactivados, {lastSummary.deactivated} desactivados.
        </div>
      )}

      {sync.isError && (
        <p className={styles.error}>No se pudo sincronizar el catálogo. Reintentá en unos segundos.</p>
      )}

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>
            Catálogo vacío. Hacé click en "Sincronizar ahora" para traer los tipos desde IClass.
          </p>
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
                  <td className={styles.desc}>{t.description || '—'}</td>
                  <td>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      background: t.active ? 'var(--color-success-bg, #e6f6e6)' : 'var(--color-neutral-bg, #eee)',
                      color: t.active ? 'var(--color-success-text, #1a6f1a)' : 'var(--color-neutral-text, #555)',
                    }}>
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
    </>
  );
}
