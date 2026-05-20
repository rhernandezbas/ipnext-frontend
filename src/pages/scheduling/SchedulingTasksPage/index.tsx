import { useFilteredTasks } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TasksTableView } from './components/TasksTableView';
import { TasksKanbanView } from './components/TasksKanbanView';
import { useTasksFilterUrl } from './hooks/useTasksFilterUrl';
import styles from './SchedulingTasksPage.module.css';

// ── SVG Icons (mirror of SchedulingProjectsPage for design consistency) ───────
function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function SchedulingTasksPage() {
  const { filter, view, setFilter, setView } = useTasksFilterUrl();
  const { data: tasks = [], isLoading, refetch } = useFilteredTasks(filter);
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
      {/* Header — mirror of SchedulingProjectsPage for visual consistency */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Tareas</h1>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnIcon} title="Recargar" onClick={() => void refetch()}>
            <IconRefresh />
          </button>
          <button className={styles.btnPrimary} onClick={() => { /* TODO: create-task modal */ }}>
            <IconPlus /> Añadir
          </button>
        </div>
      </div>

      {/* Filter bar + view toggle */}
      <TaskFilterBar
        filter={filter}
        view={view}
        onFilterChange={setFilter}
        onViewChange={setView}
      />

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.tableSection}>
          {view === 'table' ? (
            <TasksTableView tasks={tasks} loading={isLoading} availableStages={availableStages} />
          ) : (
            <TasksKanbanView tasks={tasks} filter={filter} />
          )}
        </div>
      </div>
    </div>
  );
}
