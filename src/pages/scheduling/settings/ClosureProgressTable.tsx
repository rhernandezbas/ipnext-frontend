import { Link } from 'react-router-dom';
import { usePendingList } from '@/hooks/useIClassClosure';
import type { ClosurePendingItem } from '@/api/iclassClosure.api';
import styles from './ClosureProgressTable.module.css';

function StatusCell({ done }: { done: boolean }) {
  return done ? (
    <span className={styles.statusDone} aria-label="completado">
      ✓
    </span>
  ) : (
    <span className={styles.statusPending} aria-label="pendiente">
      ✗
    </span>
  );
}

function TaskCell({ task }: { task: ClosurePendingItem['task'] }) {
  if (!task) {
    return <span className={styles.taskDash}>—</span>;
  }
  return (
    <Link to={`/admin/scheduling/tasks/${task.id}`} className={styles.taskLink}>
      <span className={styles.seqNumber}>#{task.sequenceNumber}</span>
      {task.title}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>✓</span>
      <p className={styles.emptyTitle}>Sin side-effects pendientes</p>
      <p className={styles.emptyText}>
        Todas las OS cerradas tienen sus efectos secundarios completados.
      </p>
    </div>
  );
}

/**
 * Tabla de progreso de side-effects pendientes en el cierre de OS de IClass.
 * Muestra una fila por OS pendiente: estado de comentario, inventario, auditoría,
 * intentos de auditoría y enlace a la tarea local vinculada.
 * Hace polling cada 5 s mientras haya items (stop-at-empty via usePendingList).
 */
export function ClosureProgressTable() {
  const { data, isLoading } = usePendingList();

  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h4 className={styles.title}>Side-effects pendientes</h4>
        <p className={styles.subtitle}>
          OS cerradas con comentario, inventario o auditoría sin completar
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colId}>IClass OS</th>
              <th className={styles.colStatus}>Comentario</th>
              <th className={styles.colStatus}>Inventario</th>
              <th className={styles.colStatus}>Auditoría</th>
              <th className={styles.colAttempts}>Intentos</th>
              <th className={styles.colTask}>Tarea</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.iclassId}>
                <td>
                  <span className={styles.iclassId}>{item.iclassId}</span>
                </td>
                <td className={styles.colStatus}>
                  <StatusCell done={item.commentPosted} />
                </td>
                <td className={styles.colStatus}>
                  <StatusCell done={item.inventoryBuilt} />
                </td>
                <td className={styles.colStatus}>
                  <StatusCell done={item.auditDone} />
                </td>
                <td className={styles.colAttempts}>
                  <span className={styles.attempts}>{item.auditAttempts}</span>
                </td>
                <td>
                  <TaskCell task={item.task} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
