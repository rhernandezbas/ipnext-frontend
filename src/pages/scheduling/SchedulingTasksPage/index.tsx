import { TasksPageBase } from './TasksPageBase';

/**
 * Tareas page (`/admin/scheduling/tasks`) — customer tasks. Thin wrapper over the
 * shared {@link TasksPageBase}. The project select in the create modal excludes
 * network projects so the customer flow never tries to attach a node project
 * (the backend would 422).
 *
 * `kind="customer"` is merged into the backend filter (#40b fix-c) so node tasks
 * never leak into the client Tareas list — both the table and the Kanban view
 * read from this same filtered query.
 */
export default function SchedulingTasksPage() {
  return (
    <TasksPageBase
      title="Tareas"
      kind="customer"
      projectPredicate={p => !p.isNetworkProject}
      hiddenColumns={['networkSiteName']}
    />
  );
}
