import { TasksPageBase } from './SchedulingTasksPage/TasksPageBase';

/**
 * Tareas Nodos page (`/admin/scheduling/nodos`) — network/node tasks only. Thin
 * wrapper over the shared {@link TasksPageBase}:
 *  - `kind="network"` is a PAGE CONSTANT merged at fetch time (never in the URL,
 *    not user-editable) so the list only ever shows `kind='network'` tasks.
 *  - the create modal opens locked in network mode (no toggle).
 *  - the project select shows only `isNetworkProject === true` projects.
 *  - independent column-visibility namespace ('nodeTasks') so it doesn't clash
 *    with the customer Tareas page.
 *  - the Cliente column is hidden structurally (#40b fix-b): node tasks have no
 *    customer, so the column is dropped from the table AND the ColumnSelector
 *    (not just toggled off) so it can never resurface.
 */
export default function SchedulingNodeTasksPage() {
  return (
    <TasksPageBase
      title="Tareas Nodos"
      kind="network"
      modalDefaultMode="network"
      projectPredicate={p => p.isNetworkProject === true}
      columnsStorageKey="scheduling-node-tasks-visible-columns"
      emptyMessage="No hay tareas de nodos para mostrar."
      hiddenColumns={['customerName']}
    />
  );
}
