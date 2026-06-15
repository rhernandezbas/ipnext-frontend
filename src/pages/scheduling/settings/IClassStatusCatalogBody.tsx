import { useMemo, useState } from 'react';
import { useIClassStatusCatalog, useSyncIClassStatuses, useUpdateIClassStatus } from '@/hooks/useIClassStatusCatalog';
import { useWorkflows } from '@/hooks/useWorkflows';
import { Can } from '@/components/auth/Can';
import type { IClassStatusCatalogSyncResult } from '@/types/iclassStatusCatalog';
import styles from './IClassSettings.module.css';
import catalogStyles from './IClassStatusCatalogBody.module.css';

type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Estados de IClass" — tabla del catálogo configurable de estados.
 * Cada estado que aparece en IClass se registra solo (auto-discovery).
 * El operador puede personalizar la etiqueta (displayLabel), el color y
 * activar el tracking (tracked=true → muestra badge en la tarea).
 *
 * Permisos:
 * - `iclass.read`: ver la tabla.
 * - `iclass.manage`: editar displayLabel/color/tracked/prominenseStageId + botón Sincronizar.
 *
 * Mapeo de stage: cada estado IClass puede mapearse a un Stage de Prominense
 * (columna del kanban). Los stages son POR-WORKFLOW, por eso el selector los
 * agrupa por workflow (optgroup) — el BE solo auto-mueve tareas cuyo workflow
 * coincide con el del stage elegido. El mapeo es global por estado IClass.
 *
 * Patrón idéntico a IClassResultCodeMappingBody (auto-save inline en PATCH).
 */
export function IClassStatusCatalogBody() {
  const { data: entries, isLoading } = useIClassStatusCatalog();
  const { data: workflows } = useWorkflows();
  const sync = useSyncIClassStatuses();
  const update = useUpdateIClassStatus();

  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [lastSummary, setLastSummary] = useState<IClassStatusCatalogSyncResult | null>(null);

  /** Índice stageId → "Workflow — Stage" para mostrar el mapeo en read-only. */
  const stageLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wf of workflows ?? []) {
      for (const stage of wf.stages) {
        map.set(stage.id, `${wf.name} — ${stage.name}`);
      }
    }
    return map;
  }, [workflows]);

  async function handleSync() {
    try {
      setLastSummary(await sync.mutateAsync());
    } catch {
      // surfaced via sync.isError banner
    }
  }

  async function handleUpdate(statusCode: string, field: 'displayLabel' | 'color' | 'tracked' | 'prominenseStageId', value: string | boolean | null) {
    setRowStatus(s => ({ ...s, [statusCode]: 'saving' }));
    try {
      await update.mutateAsync({ statusCode, payload: { [field]: value } });
      setRowStatus(s => ({ ...s, [statusCode]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[statusCode];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [statusCode]: 'error' }));
    }
  }

  const count = entries?.length ?? 0;
  const trackedCount = entries?.filter(e => e.tracked).length ?? 0;

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={catalogStyles.countPill}>
            {trackedCount} de {count} activos
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <Can permission="iclass.manage">
            <button
              className={styles.btnPrimary}
              onClick={handleSync}
              disabled={sync.isPending}
              data-testid="sync-btn"
            >
              {sync.isPending ? 'Sincronizando…' : 'Sincronizar estados'}
            </button>
          </Can>
        </div>
      </div>

      <Can permission="iclass.read">
        <p className={styles.helper}>
          Los estados se descubren automáticamente cuando aparecen en una OS de IClass. Activá los que querés ver como badge en las tareas y personalizá la etiqueta y el color.
        </p>
        <p className={styles.helper}>
          El mapeo de Stage es global por estado IClass, pero el auto-move solo aplica a tareas del workflow del stage elegido.
        </p>

        {lastSummary && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            <span>
              <span className={styles.bannerTitle}>Sincronizados {lastSummary.synced} estados.</span>{' '}
              {lastSummary.created} nuevos · {lastSummary.updated} actualizados.
            </span>
          </div>
        )}

        {sync.isError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span><span className={styles.bannerTitle}>No se pudieron sincronizar los estados.</span> Reintentá en unos segundos.</span>
          </div>
        )}

        {isLoading ? (
          <div className={styles.tableWrap}>
            <p className={styles.tableLoading}>Cargando…</p>
          </div>
        ) : count === 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>Sin estados sincronizados</p>
              <p className={styles.emptyStateText}>
                Todavía no hay estados de IClass en el catálogo. Hacé click en "Sincronizar estados" para traerlos desde IClass, o esperá a que aparezcan automáticamente al cerrar una OS.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Código IClass</th>
                  <th style={{ width: '25%' }}>Etiqueta IClass</th>
                  <th>Etiqueta personalizada</th>
                  <th style={{ width: '7rem' }}>Color</th>
                  <th style={{ width: '16rem' }}>Stage Prominense</th>
                  <th style={{ width: '6rem' }}>Mostrar</th>
                  <th style={{ width: '3rem' }} aria-label="Estado" />
                </tr>
              </thead>
              <tbody>
                {entries!.map(entry => {
                  const status = rowStatus[entry.statusCode];
                  const isSaving = status === 'saving';
                  return (
                    <tr key={entry.statusCode}>
                      {/* Código IClass — read-only */}
                      <td>
                        <span className={catalogStyles.codeLabel}>{entry.statusCode}</span>
                      </td>
                      {/* Etiqueta original de IClass — read-only */}
                      <td>
                        <span className={catalogStyles.iclassLabel}>{entry.iclassLabel}</span>
                      </td>
                      {/* displayLabel editable */}
                      <td>
                        <Can
                          permission="iclass.manage"
                          fallback={
                            <span className={catalogStyles.displayLabelReadonly}>
                              {entry.displayLabel ?? <em className={catalogStyles.noCustom}>—</em>}
                            </span>
                          }
                        >
                          <input
                            type="text"
                            className={catalogStyles.displayLabelInput}
                            defaultValue={entry.displayLabel ?? ''}
                            placeholder={entry.iclassLabel}
                            disabled={isSaving}
                            aria-label={`Etiqueta personalizada para ${entry.statusCode}`}
                            onBlur={e => {
                              const val = e.target.value.trim() || null;
                              if (val !== entry.displayLabel) {
                                void handleUpdate(entry.statusCode, 'displayLabel', val);
                              }
                            }}
                          />
                        </Can>
                      </td>
                      {/* Color picker */}
                      <td>
                        <Can
                          permission="iclass.manage"
                          fallback={
                            <span
                              className={catalogStyles.colorSwatch}
                              style={{ background: entry.color ?? 'transparent' }}
                              aria-label={entry.color ?? 'Sin color'}
                            />
                          }
                        >
                          <div className={catalogStyles.colorCell}>
                            <input
                              type="color"
                              className={catalogStyles.colorPicker}
                              value={entry.color ?? '#6b7280'}
                              disabled={isSaving}
                              aria-label={`Color para ${entry.statusCode}`}
                              onBlur={e => {
                                void handleUpdate(entry.statusCode, 'color', e.target.value);
                              }}
                            />
                            {entry.color && (
                              <button
                                type="button"
                                className={catalogStyles.clearColorBtn}
                                title="Quitar color"
                                disabled={isSaving}
                                onClick={() => void handleUpdate(entry.statusCode, 'color', null)}
                                aria-label={`Quitar color de ${entry.statusCode}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </Can>
                      </td>
                      {/* Stage de Prominense — selector agrupado por workflow */}
                      <td>
                        <Can
                          permission="iclass.manage"
                          fallback={
                            <span className={catalogStyles.stageReadonly}>
                              {entry.prominenseStageId
                                ? (stageLabelById.get(entry.prominenseStageId) ?? entry.prominenseStageId)
                                : <em className={catalogStyles.noCustom}>Sin mapeo</em>}
                            </span>
                          }
                        >
                          <select
                            className={catalogStyles.stageSelect}
                            value={entry.prominenseStageId ?? ''}
                            disabled={isSaving}
                            aria-label={`Stage de Prominense para ${entry.statusCode}`}
                            onChange={e => {
                              const val = e.target.value || null;
                              if (val !== entry.prominenseStageId) {
                                void handleUpdate(entry.statusCode, 'prominenseStageId', val);
                              }
                            }}
                          >
                            <option value="">Sin mapeo</option>
                            {/* Stage huérfano: el mapeo apunta a un stage que ya no existe
                                en ningún workflow. Sin esta option "fantasma" el value no
                                matchearía ninguna opción y el browser mostraría "Sin mapeo"
                                falsamente — el operador creería que no hay mapeo cuando sí lo hay. */}
                            {entry.prominenseStageId && !stageLabelById.has(entry.prominenseStageId) && (
                              <option value={entry.prominenseStageId} className={catalogStyles.stageOrphanOption}>
                                ⚠ Stage inexistente ({entry.prominenseStageId})
                              </option>
                            )}
                            {(workflows ?? []).map(wf => (
                              <optgroup key={wf.id} label={wf.name}>
                                {wf.stages.map(stage => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </Can>
                      </td>
                      {/* tracked toggle */}
                      <td>
                        <Can
                          permission="iclass.manage"
                          fallback={
                            <span className={catalogStyles.trackedReadonly} aria-label={entry.tracked ? 'Activo' : 'Inactivo'}>
                              {entry.tracked ? '●' : '○'}
                            </span>
                          }
                        >
                          <label className={styles.switch} title={entry.tracked ? 'Desactivar badge' : 'Activar badge'}>
                            <input
                              type="checkbox"
                              checked={entry.tracked}
                              disabled={isSaving}
                              aria-label={`Mostrar badge para ${entry.statusCode}`}
                              onChange={e => void handleUpdate(entry.statusCode, 'tracked', e.target.checked)}
                            />
                            <span className={styles.switchTrack} />
                          </label>
                        </Can>
                      </td>
                      {/* Row status icon */}
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
      </Can>
    </div>
  );
}
