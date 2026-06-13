import { Link } from 'react-router-dom';
import { useFilteredTasks } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import { TasksTableView } from './SchedulingTasksPage/components/TasksTableView';
import styles from './SchedulingArchivedTasksPage.module.css';

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/**
 * Archived tasks page (#86) — shows tasks with archivedAt IS NOT NULL.
 * Reached via the "Archivadas" link in the tasks header.
 * Route: /admin/scheduling/archivadas
 */
export default function SchedulingArchivedTasksPage() {
  const { data: tasks = [], isLoading } = useFilteredTasks({ archived: true });
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: allRbacUsers = [] } = useRbacUsers();
  const { data: priorities = [] } = useTaskPriorities();

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>
            Scheduling / <Link to="/admin/scheduling/tasks" className={styles.breadcrumbLink}>Tareas</Link> /
          </span>
          <h1 className={styles.title}>Tareas Archivadas</h1>
        </div>
        <div className={styles.headerRight}>
          <Link to="/admin/scheduling/tasks" className={styles.backLink}>
            <IconBack /> Volver a Tareas
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className={styles.infoBanner} role="status">
        Las tareas archivadas fueron cerradas o descartadas y luego archivadas. No aparecen en la vista principal de Tareas.
      </div>

      {/* Table */}
      <div className={styles.body}>
        {!isLoading && tasks.length === 0 ? (
          <div className={styles.empty} data-testid="archived-tasks-empty">
            <p className={styles.emptyTitle}>No hay tareas archivadas</p>
            <p className={styles.emptyHint}>
              Las tareas cerradas o descartadas aparecerán aquí cuando sean archivadas desde la lista de tareas.
            </p>
          </div>
        ) : (
          <TasksTableView
            tasks={tasks}
            loading={isLoading}
            projects={projects}
            workflows={workflows}
            priorities={priorities}
            admins={allRbacUsers}
            emptyMessage="No hay tareas archivadas."
            readOnly
          />
        )}
      </div>
    </div>
  );
}
