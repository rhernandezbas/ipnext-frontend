import { Link } from 'react-router-dom';
import { useIClassDispatchPreview } from '@/hooks/useIClassDispatchPreview';
import { Can } from '@/components/auth/Can';
import styles from './IClassSettings.module.css';

/**
 * Sub-tab "Qué se envía a IClass" — tabla read-only que describe, por proyecto
 * mapeado, qué datos enviará Prominense al crear una OS en IClass.
 *
 * - La tabla es DERIVADA: no guarda estado propio, refleja la configuración existente.
 * - El estado inicial de la OS lo asigna IClass internamente (Prominense no lo manda).
 * - El nodo se resuelve en runtime por ciudad del cliente.
 *
 * Permisos: `iclass.read`.
 */
export function IClassDispatchPreviewBody() {
  const { data: rows, isLoading } = useIClassDispatchPreview();

  return (
    <div className={styles.section}>
      <Can permission="iclass.read">
        <p className={styles.helper}>
          Resumen de los datos que Prominense envía a IClass al crear una OS. Es read-only — para cambiar el tipo de OS de un proyecto, usá la sub-tab{' '}
          <strong>Mapeo de proyectos</strong>.
        </p>

        {isLoading ? (
          <div className={styles.tableWrap}>
            <p className={styles.tableLoading}>Cargando…</p>
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>Sin proyectos configurados</p>
              <p className={styles.emptyStateText}>
                No hay proyectos con tipo de OS mapeado. Configurá el mapeo en la sub-tab Mapeo de proyectos.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Tipo de OS</th>
                  <th>Estado inicial</th>
                  <th>Código de cliente</th>
                  <th>Teléfono</th>
                  <th>Código de OS</th>
                  <th>Nodo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.projectId}>
                    <td style={{ fontWeight: 'var(--font-weight-medium)' as never }}>{row.projectTitle}</td>
                    <td>
                      {row.soType ? (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <code style={{ fontSize: '0.85em' }}>{row.soType.code}</code>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.82em' }}>{row.soType.description}</span>
                        </span>
                      ) : (
                        <span className={`${styles.typeBadge} ${styles.typeBadgeInactive}`}>
                          Sin mapeo
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.typeBadge} ${styles.typeBadgeNeutral}`}>
                        Lo asigna IClass
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      contractCode / customerCode
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      customer-phone
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      task-sequence-number
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
                      Por ciudad del cliente
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.helper} style={{ marginTop: 'var(--space-3)' }}>
          Los estados que devuelve IClass se configuran en{' '}
          <Link
            to="?tab=iclass&sub=estados-iclass"
            aria-label="Estados de IClass"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
          >
            Estados de IClass
          </Link>.
        </p>
      </Can>
    </div>
  );
}
