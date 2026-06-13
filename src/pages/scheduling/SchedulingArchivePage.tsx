import { useSchedulingArchive } from '@/hooks/useSchedulingArchive';
import { formatDateShort } from '@/utils/formatDate';
import styles from './SchedulingArchivePage.module.css';

export default function SchedulingArchivePage() {
  const { data: tasks, isLoading } = useSchedulingArchive();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Archivo</h1>
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Técnico</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className={styles.loading}>Cargando archivo...</td></tr>
              ) : (tasks ?? []).length === 0 ? (
                <tr><td colSpan={4} className={styles.empty}>No hay tareas archivadas.</td></tr>
              ) : (
                (tasks ?? []).map(task => (
                  <tr key={task.id} className={styles.row}>
                    <td className={styles.cell}>{task.proyecto}</td>
                    <td className={styles.cellMuted}>{task.tecnico}</td>
                    <td className={styles.cellMuted}>{formatDateShort(task.fecha)}</td>
                    <td className={styles.cell}>
                      <span className={styles.statusPill}>{task.estado}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
