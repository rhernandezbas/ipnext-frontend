import { useServiceInstalledItems } from '@/hooks/useServiceInventory';
import { useTaskMaterials } from '@/hooks/useTaskMaterials';
import { Can } from '@/components/auth/Can';
import styles from './ContractInventoryReadonly.module.css';

interface Props {
  contractId: string | null;
  taskId: string | null;
}

/**
 * Read-only view of a contract's installed equipment + task material consumptions.
 * Used in the CustomerSidebar's "Inventario" tab.
 * Gated with inventory.read. No edit/remove actions — observe only.
 */
export function ContractInventoryReadonly({ contractId, taskId }: Props) {
  const { data: items = [], isLoading: itemsLoading } = useServiceInstalledItems(
    contractId ?? undefined,
    !!contractId,
  );
  const { data: consumptions = [], isLoading: consumptionsLoading } = useTaskMaterials(
    taskId ?? undefined,
    !!taskId,
  );

  if (!contractId) {
    return (
      <div className={styles.empty}>
        Sin contrato asignado — no hay inventario que mostrar.
      </div>
    );
  }

  return (
    <Can permission="inventory.read">
      <div className={styles.root}>
        {/* ── Equipos instalados ─────────────────────────────────────────── */}
        <section>
          <h4 className={styles.sectionTitle}>Equipos instalados</h4>
          {itemsLoading ? (
            <p className={styles.muted}>Cargando equipos…</p>
          ) : items.length === 0 ? (
            <p className={styles.muted}>Sin equipos cargados en este contrato.</p>
          ) : (
            <ul className={styles.list}>
              {items.map(it => (
                <li key={it.id} className={styles.item}>
                  <span className={styles.tag}>{it.type}</span>
                  {it.serialNumber && <span className={styles.detail}>SN: {it.serialNumber}</span>}
                  {it.mac && <span className={styles.detail}>MAC: {it.mac}</span>}
                  {it.model && <span className={styles.detail}>{it.model}</span>}
                  <span className={`${styles.status} ${it.status === 'active' ? styles.statusActive : styles.statusRemoved}`}>
                    {it.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Materiales consumidos (de esta tarea) ─────────────────────── */}
        {taskId && (
          <section>
            <h4 className={styles.sectionTitle}>Materiales consumidos (tarea)</h4>
            {consumptionsLoading ? (
              <p className={styles.muted}>Cargando materiales…</p>
            ) : consumptions.length === 0 ? (
              <p className={styles.muted}>Sin consumos registrados.</p>
            ) : (
              <ul className={styles.list}>
                {consumptions.map(c => (
                  <li key={c.id} className={styles.item}>
                    <span className={styles.materialName}>{c.materialName}</span>
                    <span className={styles.detail}>× {c.quantity}{c.unit ? ` ${c.unit}` : ''}</span>
                    {c.notes && <span className={styles.muted}>{c.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Can>
  );
}
