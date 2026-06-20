import { useState } from 'react';
import {
  useGrVendedorMappings,
  useGrVendedores,
  useSetGrVendedorMapping,
} from '@/hooks/useGrVendedorMappings';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button';
import styles from './VendedorMapping.module.css';

type RowStatus = 'saving' | 'saved' | 'error';

/**
 * Sub-tab "Vendedores GR" del SchedulingSettingsPage (Fase 2b, cartera "Mis
 * clientes"). Mapea cada usuario de Prominense ↔ su nombre de VENDEDOR en
 * Gestión Real, para que la cartera de cada agente se arme a partir de las OS
 * de GR donde figura como vendedor.
 *
 * Patrón clonado del mapeo técnico↔cuadrilla de IClass: tabla de usuarios +
 * un selector por fila con auto-save (cambiar el selector dispara un PATCH
 * inmediato). La opción "— sin mapear —" limpia el mapeo (PATCH con null).
 *
 * GR está en camino a deprecarse: este componente + su CSS + api + hook viven
 * aislados (no comparten módulos con el núcleo) para poder borrarse de una pieza.
 *
 * Permisos:
 * - `recapture.read`: ver la tabla.
 * - `recapture.manage`: editar el selector.
 */
export function VendedorMappingBody() {
  const { data: mappings, isLoading, isError, refetch } = useGrVendedorMappings();
  const { data: vendedores } = useGrVendedores();
  const setMapping = useSetGrVendedorMapping();
  const { can } = useMyPermissions();
  const canManage = can('recapture.manage');

  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  async function handleChange(userId: string, value: string) {
    const grVendedorName = value === '' ? null : value;
    setRowStatus(s => ({ ...s, [userId]: 'saving' }));
    try {
      await setMapping.mutateAsync({ userId, grVendedorName });
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
  const catalog = vendedores ?? [];

  return (
    <div className={styles.section}>
      <Can permission="recapture.read">
        <p className={styles.helper}>
          Asigná a cada usuario su nombre de vendedor en Gestión Real. El cambio es
          inmediato y se usa para armar la cartera "Mis clientes" de cada agente a
          partir de las órdenes de servicio de GR.
        </p>

        {isError && !mappings ? (
          <div className={styles.tableWrap}>
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No se pudo cargar</p>
              <p className={styles.emptyStateText}>
                Ocurrió un error al traer los usuarios. Reintentá en unos segundos.
              </p>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className={styles.tableWrap}>
            <p className={styles.tableLoading}>Cargando…</p>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>Sin usuarios</p>
              <p className={styles.emptyStateText}>
                No hay usuarios registrados en el sistema.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Usuario</th>
                  <th style={{ width: '20%' }}>Login</th>
                  <th>Vendedor en Gestión Real</th>
                  <th style={{ width: '3rem' }} aria-label="Estado" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = rowStatus[item.userId];
                  const isSaving = status === 'saving';
                  // Keep a currently-mapped vendedor selectable even if it has
                  // dropped out of the distinct catalog (e.g. no recent OS).
                  const options =
                    item.grVendedorName && !catalog.includes(item.grVendedorName)
                      ? [item.grVendedorName, ...catalog]
                      : catalog;

                  return (
                    <tr key={item.userId}>
                      <td className={styles.userName}>{item.userName}</td>
                      <td className={styles.userLogin}>{item.userLogin}</td>
                      <td>
                        <div className={styles.selectCell}>
                          <select
                            className={styles.select}
                            value={item.grVendedorName ?? ''}
                            disabled={isSaving || !canManage}
                            aria-label={`Vendedor de ${item.userName}`}
                            onChange={e => void handleChange(item.userId, e.target.value)}
                          >
                            <option value="">— sin mapear —</option>
                            {options.map(v => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
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
      </Can>
    </div>
  );
}
