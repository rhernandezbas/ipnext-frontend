import { useState, useMemo } from 'react';
import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useIClassSoTypes } from '@/hooks/useIClassSoTypes';
import styles from '../SchedulingTaskCategoriesPage.module.css';

type FilterMode = 'all' | 'mapped' | 'unmapped';
type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Mapeo de proyectos" — tabla de Projects con dropdown de IClass SO type
 * por fila. Auto-save inline: el change del dropdown dispara PATCH /api/projects/:id
 * con `{ iclassSoTypeId }`. Visual feedback por fila: saving / saved (2s) / error.
 */
export function IClassProjectMappingBody() {
  const { data: projects, isLoading: lp } = useProjects('all');
  const { data: types,    isLoading: lt } = useIClassSoTypes(true);
  const update = useUpdateProject();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

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
      <div className={styles.card}>
        <p className={styles.empty}>Cargando…</p>
      </div>
    );
  }

  const activeTypes = types ?? [];

  if (activeTypes.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>
          No hay tipos de OS en el catálogo. Primero sincronizá el catálogo en la sub-tab "Catálogo".
        </p>
      </div>
    );
  }

  if (visible.length === 0 && filter === 'all') {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>No hay proyectos para mapear.</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar} role="radiogroup" aria-label="Filtrar proyectos">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="radio"
            name="map-filter"
            checked={filter === 'all'}
            onChange={() => setFilter('all')}
          />
          Todos
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="radio"
            name="map-filter"
            checked={filter === 'mapped'}
            onChange={() => setFilter('mapped')}
          />
          Solo mapeados
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="radio"
            name="map-filter"
            checked={filter === 'unmapped'}
            onChange={() => setFilter('unmapped')}
          />
          Solo sin mapear
        </label>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Tipo de OS en IClass</th>
              <th style={{ width: '2rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const status = rowStatus[p.id];
              return (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>
                    <select
                      className={styles.input}
                      value={p.iclassSoTypeId ?? ''}
                      onChange={e => handleChange(p.id, e.target.value)}
                      disabled={status === 'saving'}
                    >
                      <option value="">(sin mapeo)</option>
                      {activeTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.code}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {status === 'saving' && <span aria-label="Guardando">⏳</span>}
                    {status === 'saved'  && <span aria-label="Guardado">✓</span>}
                    {status === 'error'  && <span aria-label="Error" title="No se pudo guardar">⚠</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
