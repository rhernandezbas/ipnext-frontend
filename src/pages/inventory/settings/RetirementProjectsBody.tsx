import { useState } from 'react';
import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { Can } from '@/components/auth/Can';
import styles from './RetirementProjectsBody.module.css';

type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Proyectos de retiro" — lista de proyectos con toggle por fila.
 * Habilita/deshabilita el retiro manual de equipos por proyecto.
 * Auto-save inline via PATCH /api/projects/:id { allowsEquipmentRetirement }.
 * Gateado por inventory.manage: sin el permiso, la tabla es read-only.
 */
export function RetirementProjectsBody() {
  const { data: projects, isLoading } = useProjects('all');
  const update = useUpdateProject();
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  async function handleToggle(projectId: string, current: boolean) {
    const next = !current;
    setRowStatus(s => ({ ...s, [projectId]: 'saving' }));
    try {
      await update.mutateAsync({ id: projectId, data: { allowsEquipmentRetirement: next } });
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

  if (isLoading) {
    return (
      <div className={styles.tableWrap}>
        <p className={styles.tableLoading}>Cargando…</p>
      </div>
    );
  }

  const visible = projects ?? [];

  if (visible.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Sin proyectos</p>
          <p className={styles.emptyStateText}>No hay proyectos configurados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '55%' }}>Proyecto</th>
              <th>Retiro de equipos</th>
              <th style={{ width: '3rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const status = rowStatus[p.id];
              const enabled = p.allowsEquipmentRetirement ?? false;
              return (
                <tr key={p.id}>
                  <td>
                    <div className={styles.projectCell}>
                      {p.visible === false && <span className={styles.hiddenDot} title="Proyecto oculto" />}
                      <span className={styles.projectName}>{p.title}</span>
                    </div>
                  </td>
                  <td>
                    <Can
                      permission="inventory.manage"
                      fallback={
                        <span className={styles.readOnlyValue}>
                          {enabled ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      }
                    >
                      <label className={styles.toggleLabel} aria-label={`Retiro de equipos para ${p.title}`}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => void handleToggle(p.id, enabled)}
                          disabled={status === 'saving'}
                          className={styles.toggleCheckbox}
                        />
                        <span>{enabled ? 'Habilitado' : 'Deshabilitado'}</span>
                      </label>
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
    </div>
  );
}
