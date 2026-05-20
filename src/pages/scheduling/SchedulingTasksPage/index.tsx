import { useFilteredTasks } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TasksTableView } from './components/TasksTableView';
import { TasksKanbanView } from './components/TasksKanbanView';
import { useTasksFilterUrl } from './hooks/useTasksFilterUrl';
import styles from './SchedulingTasksPage.module.css';

export default function SchedulingTasksPage() {
  const { filter, view, setFilter, setView } = useTasksFilterUrl();
  const { data: tasks = [], isLoading } = useFilteredTasks(filter);
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();

  // Resolve the available stages for the bulk "Mover etapa" action: the workflow
  // of the project currently filtered. When no project filter is set the bulk
  // action is unavailable (button disables itself when stages list is empty).
  const selectedProject = filter.projectId
    ? projects.find(p => p.id === filter.projectId)
    : undefined;
  const availableStages = selectedProject?.workflowId
    ? workflows.find(w => w.id === selectedProject.workflowId)?.stages ?? []
    : [];

  return (
    <div className={styles.page}>
      <TaskFilterBar
        filter={filter}
        view={view}
        onFilterChange={setFilter}
        onViewChange={setView}
      />

      <div className={styles.content}>
        {view === 'table' ? (
          <TasksTableView tasks={tasks} loading={isLoading} availableStages={availableStages} />
        ) : (
          <TasksKanbanView tasks={tasks} filter={filter} />
        )}
      </div>
    </div>
  );
}
