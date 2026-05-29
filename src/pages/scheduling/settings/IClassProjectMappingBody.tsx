import { useState, useMemo } from 'react';
import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useIClassSoTypes } from '@/hooks/useIClassSoTypes';
import { Can } from '@/components/auth/Can';
import styles from './IClassSettings.module.css';

type FilterMode = 'all' | 'mapped' | 'unmapped';
type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Mapeo de proyectos" — tabla de Projects con dropdown de IClass SO
 * type por fila. Auto-save inline (PATCH on change). Filtros como segmented
 * pills con contadores. Feedback por fila con icons semánticos.
 */
export function IClassProjectMappingBody() {
  const { data: projects, isLoading: lp } = useProjects('all');
  const { data: types,    isLoading: lt } = useIClassSoTypes(true);
  const update = useUpdateProject();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  const counts = useMemo(() => {
    const all = projects?.length ?? 0;
    const mapped = projects?.filter(p => p.iclassSoTypeId != null).length ?? 0;
    return { all, mapped, unmapped: all - mapped };
  }, [projects]);

  const visible = useMemo(() => {
    if (!projects) return [];
    if (filter === 'mapped')   return projects.filter(p => p.iclassSoTypeId != null);
    if (filter === 'unmapped') return projects.filter(p => p.iclassSoTypeId == null);
    return projects;
  }, [projects, filter]);

  async function handleChange(projectId: string, rawValue: string) {
    const iclassSoTypeId = rawValue === '' ? null : rawValue;
    setRowStatus(s => ({ ...s, [projectId]: 'saving' }));
    try {
      await update.mutateAsync({ id: projectId, data: { iclassSoTypeId } });
      setRowStatus(s => ({ ...s, [projectId]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[projectId];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [projectId]: 'error' }));
    }
  }

  if (lp || lt) {
    return (
      <div className={styles.tableWrap}>
        <p className={styles.tableLoading}>Cargando…</p>
      </div>
    );
  }

  const activeTypes = types ?? [];

  if (activeTypes.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Catálogo de tipos vacío</p>
          <p className={styles.emptyStateText}>
            No hay tipos de OS en el catálogo. Primero sincronizá el catálogo desde la sub-tab "Catálogo".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <label className={styles.segmented} aria-label="Filtrar proyectos">
            <span className={styles.segmentedItem}>
              <input
                type="radio"
                name="map-filter"
                checked={filter === 'all'}
                onChange={() => setFilter('all')}
              />
              Todos
              <span className={styles.segmentedCount}>{counts.all}</span>
            </span>
            <span className={styles.segmentedItem}>
              <input
                type="radio"
                name="map-filter"
                checked={filter === 'mapped'}
                onChange={() => setFilter('mapped')}
                aria-label="Solo mapeados"
              />
              Mapeados
              <span className={styles.segmentedCount}>{counts.mapped}</span>
            </span>
            <span className={styles.segmentedItem}>
              <input
                type="radio"
                name="map-filter"
                checked={filter === 'unmapped'}
                onChange={() => setFilter('unmapped')}
                aria-label="Solo sin mapear"
              />
              Sin mapear
              <span className={styles.segmentedCount}>{counts.unmapped}</span>
            </span>
          </label>
        </div>
      </div>

      {visible.length === 0 && filter === 'all' ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>Sin proyectos</p>
            <p className={styles.emptyStateText}>No hay proyectos para mapear.</p>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Proyecto</th>
                <th>Tipo de OS en IClass</th>
                <th style={{ width: '3rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const status = rowStatus[p.id];
                const value = p.iclassSoTypeId ?? '';
                return (
                  <tr key={p.id}>
                    <td>
                      <div className={styles.projectCell}>
                        {p.visible === false && <span className={styles.hiddenDot} title="Proyecto oculto" />}
                        <span className={styles.projectName}>{p.title}</span>
                      </div>
                    </td>
                    <td>
                      <Can permission="iclass.assign_to_project" fallback={<span>{value || '(sin mapeo)'}</span>}>
                        <select
                          className={`${styles.select} ${value === '' ? styles.selectUnmapped : ''}`}
                          value={value}
                          onChange={e => handleChange(p.id, e.target.value)}
                          disabled={status === 'saving'}
                        >
                          <option value="">(sin mapeo)</option>
                          {activeTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.code}</option>
                          ))}
                        </select>
                      </Can>
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
