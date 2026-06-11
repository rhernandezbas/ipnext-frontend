import { TasksPageBase } from './TasksPageBase';

/**
 * Tareas page (`/admin/scheduling/tasks`) — customer tasks. Thin wrapper over the
 * shared {@link TasksPageBase}. The project select in the create modal excludes
 * network projects so the customer flow never tries to attach a node project
 * (the backend would 422). Network tasks still appear in the table for label
 * resolution; the predicate only filters the MODAL list.
 */
export default function SchedulingTasksPage() {
  return <TasksPageBase title="Tareas" projectPredicate={p => !p.isNetworkProject} />;
}
