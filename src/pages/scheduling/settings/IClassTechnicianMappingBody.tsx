import { useState } from 'react';
import { useIClassTechnicianTeams, useSetTechnicianTeamMapping } from '@/hooks/useIClassTechnicianTeams';
import { useIClassTeams } from '@/hooks/useIClassTeams';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/auth/Can';
import styles from './IClassSettings.module.css';

type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Técnicos → Cuadrillas" en IClass Settings.
 *
 * Muestra cada técnico (RbacUser) con un selector de cuadrilla IClass.
 * Cambiar el selector dispara un PATCH inmediato (auto-save).
 * Si la cuadrilla mapeada está inactiva, se muestra un badge de advertencia.
 *
 * Permisos:
 * - `iclass.read`: ver la tabla.
 * - `iclass.manage`: editar el selector.
 */
export function IClassTechnicianMappingBody() {
  const { data: mappings, isLoading } = useIClassTechnicianTeams();
  const { data: teams } = useIClassTeams();
  const setMapping = useSetTechnicianTeamMapping();
  const { can } = useMyPermissions();
  const canManage = can('iclass.manage');

  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  // Solo las cuadrillas active+selectable aparecen en el dropdown
  const assignableTeams = (teams ?? []).filter(t => t.active && t.selectable);

  async function handleChange(userId: string, value: string) {
    const iclassTeamLogin = value === '' ? null : value;
    setRowStatus(s => ({ ...s, [userId]: 'saving' }));
    try {
      await setMapping.mutateAsync({ userId, iclassTeamLogin });
      setRowStatus(s => ({ ...s, [userId]: 'saved' }));
      setTimeout(() => {
        setRowStatus(s => {
          const copy = { ...s };
          delete copy[userId];
          return copy;
        });
      }, 2000);
    } catch {
      setRowStatus(s => ({ ...s, [userId]: 'error' }));
    }
  }

  const items = mappings ?? [];

  return (
    <div className={styles.section}>
      <Can permission="iclass.read">
        <p className={styles.helper}>
          Asigná cada técnico a su cuadrilla IClass. El cambio es inmediato y se usa para la asignación automática de cuadrilla al reasignar una tarea.
        </p>

        {isLoading ? (
          <div className={styles.tableWrap}>
            <p className={styles.tableLoading}>Cargando…</p>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>Sin técnicos</p>
              <p className={styles.emptyStateText}>
                No hay técnicos registrados en el sistema.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Técnico</th>
                  <th style={{ width: '20%' }}>Login</th>
                  <th>Cuadrilla IClass</th>
                  <th style={{ width: '3rem' }} aria-label="Estado" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = rowStatus[item.userId];
                  const isSaving = status === 'saving';
                  const isInactive = item.iclassTeamLogin !== null && item.teamActive === false;

                  return (
                    <tr key={item.userId}>
                      <td style={{ fontWeight: 'var(--font-weight-medium)' as never }}>{item.userName}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{item.userLogin}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <select
                            className={styles.select}
                            value={item.iclassTeamLogin ?? ''}
                            disabled={isSaving || !canManage}
                            aria-label={`Cuadrilla de ${item.userName}`}
                            onChange={e => void handleChange(item.userId, e.target.value)}
                          >
                            <option value="">Sin cuadrilla</option>
                            {assignableTeams.map(t => (
                              <option key={t.login} value={t.login}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          {isInactive && (
                            <span
                              className={`${styles.typeBadge} ${styles.typeBadgeFail}`}
                              title="La cuadrilla mapeada está inactiva. Re-mapeá a una cuadrilla activa."
                            >
                              Cuadrilla inactiva
                            </span>
                          )}
                        </div>
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
      </Can>
    </div>
  );
}
