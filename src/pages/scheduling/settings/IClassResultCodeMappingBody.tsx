import { useState, useMemo } from 'react';
import { useIClassResultCodes, useSyncIClassResultCodes, useAssignResultCodeStage } from '@/hooks/useIClassResultCodes';
import { useWorkflows } from '@/hooks/useWorkflows';
import type { IClassResultCodeSyncResult } from '@/types/iclassResultCode';
import styles from './IClassSettings.module.css';

type FilterMode = 'all' | 'mapped' | 'unmapped';
type RowStatus = 'saving' | 'saved' | 'error';

/** Classify the result-code outcome into a badge variant. */
function typeBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.startsWith('suces') || t.startsWith('éxit') || t.startsWith('exit')) return styles.typeBadgeSuccess;
  if (t.startsWith('fal') || t.startsWith('frac')) return styles.typeBadgeFail;
  return styles.typeBadgeNeutral;
}

/**
 * Sub-tab "Mapeo de resultados" — tabla de result codes de IClass con un select
 * de Stage por fila (agrupado por workflow). Cuando una OS cierra con ese
 * resultado, la tarea vinculada se mueve al Stage mapeado. Auto-save inline
 * (PATCH on change). Botón de sync para traer el catálogo desde IClass. Mismo
 * patrón que IClassProjectMappingBody.
 */
export function IClassResultCodeMappingBody() {
  const { data: codes, isLoading: lc } = useIClassResultCodes();
  const { data: workflows, isLoading: lw } = useWorkflows();
  const assign = useAssignResultCodeStage();
  const sync = useSyncIClassResultCodes();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [lastSummary, setLastSummary] = useState<IClassResultCodeSyncResult | null>(null);

  const counts = useMemo(() => {
    const all = codes?.length ?? 0;
    const mapped = codes?.filter(c => c.mappedStageId != null).length ?? 0;
    return { all, mapped, unmapped: all - mapped };
  }, [codes]);

  const visible = useMemo(() => {
    if (!codes) return [];
    if (filter === 'mapped') return codes.filter(c => c.mappedStageId != null);
    if (filter === 'unmapped') return codes.filter(c => c.mappedStageId == null);
    return codes;
  }, [codes, filter]);

  async function handleChange(id: string, rawValue: string) {
    const stageId = rawValue === '' ? null : rawValue;
    setRowStatus(s => ({ ...s, [id]: 'saving' }));
    try {
      await assign.mutateAsync({ id, stageId });
      setRowStatus(s => ({ ...s, [id]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[id];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [id]: 'error' }));
    }
  }

  async function handleSync() {
    try {
      setLastSummary(await sync.mutateAsync());
    } catch {
      // surfaced via sync.isError banner
    }
  }

  const wfs = workflows ?? [];

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <label className={styles.segmented} aria-label="Filtrar resultados">
            <span className={styles.segmentedItem}>
              <input type="radio" name="rc-filter" checked={filter === 'all'} onChange={() => setFilter('all')} />
              Todos
              <span className={styles.segmentedCount}>{counts.all}</span>
            </span>
            <span className={styles.segmentedItem}>
              <input type="radio" name="rc-filter" checked={filter === 'mapped'} onChange={() => setFilter('mapped')} aria-label="Solo mapeados" />
              Mapeados
              <span className={styles.segmentedCount}>{counts.mapped}</span>
            </span>
            <span className={styles.segmentedItem}>
              <input type="radio" name="rc-filter" checked={filter === 'unmapped'} onChange={() => setFilter('unmapped')} aria-label="Solo sin mapear" />
              Sin mapear
              <span className={styles.segmentedCount}>{counts.unmapped}</span>
            </span>
          </label>
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.btnPrimary} onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar resultados'}
          </button>
        </div>
      </div>

      <p className={styles.helper}>
        Cuando una OS se cierra en IClass con un resultado, la tarea vinculada se mueve al estado que elijas acá. Los resultados se sincronizan desde IClass; el mapeo se guarda al instante.
      </p>

      {lastSummary && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span>
            <span className={styles.bannerTitle}>Sincronizados {lastSummary.synced} resultados.</span>{' '}
            {lastSummary.created} nuevos · {lastSummary.updated} actualizados.
          </span>
        </div>
      )}

      {sync.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudieron sincronizar los resultados.</span> Reintentá en unos segundos.</span>
        </div>
      )}

      {lc || lw ? (
        <div className={styles.tableWrap}>
          <p className={styles.tableLoading}>Cargando…</p>
        </div>
      ) : counts.all === 0 ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>Sin resultados sincronizados</p>
            <p className={styles.emptyStateText}>
              Todavía no hay resultados de cierre en el catálogo. Hacé click en "Sincronizar resultados" para traerlos desde IClass.
            </p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>Nada para mostrar</p>
            <p className={styles.emptyStateText}>Ningún resultado coincide con este filtro.</p>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Resultado de cierre</th>
                <th>Mover la tarea a</th>
                <th style={{ width: '3rem' }} aria-label="Estado" />
              </tr>
            </thead>
            <tbody>
              {visible.map(rc => {
                const status = rowStatus[rc.id];
                const value = rc.mappedStageId ?? '';
                return (
                  <tr key={rc.id}>
                    <td>
                      <div className={styles.projectCell}>
                        <span className={styles.projectName}>{rc.code}</span>
                        <span className={`${styles.typeBadge} ${typeBadgeClass(rc.type)}`}>{rc.type}</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className={`${styles.select} ${value === '' ? styles.selectUnmapped : ''}`}
                        value={value}
                        onChange={e => handleChange(rc.id, e.target.value)}
                        disabled={status === 'saving'}
                        aria-label={`Estado destino para ${rc.code}`}
                      >
                        <option value="">(no mover)</option>
                        {wfs.map(wf => (
                          <optgroup key={wf.id} label={wf.name}>
                            {wf.stages.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td>
                      {status === 'saving' && <span className={`${styles.rowStatus} ${styles.rowStatusSaving}`} aria-label="Guardando">⏳</span>}
                      {status === 'saved' && <span className={`${styles.rowStatus} ${styles.rowStatusSaved}`} aria-label="Guardado">✓</span>}
                      {status === 'error' && <span className={`${styles.rowStatus} ${styles.rowStatusError}`} aria-label="Error" title="No se pudo guardar">⚠</span>}
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
