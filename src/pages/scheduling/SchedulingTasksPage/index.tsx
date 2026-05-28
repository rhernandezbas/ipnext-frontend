import { useState } from 'react';
import { useFilteredTasks, useCreateTask } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useTechnicians, useAdmins } from '@/hooks/useAdmins';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TasksTableView, ALL_TASK_COLUMNS } from './components/TasksTableView';
import { TasksKanbanView } from './components/TasksKanbanView';
import { ColumnSelector } from './components/ColumnSelector';
import { CreateTaskModal } from './components/CreateTaskModal';
import { useTasksFilterUrl } from './hooks/useTasksFilterUrl';
import { useVisibleColumns } from './hooks/useVisibleColumns';
import styles from './SchedulingTasksPage.module.css';

const DEFAULT_VISIBLE_COLUMNS = ALL_TASK_COLUMNS.map(c => c.key);

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
  // stageCategory is a CLIENT-side filter — the backend doesn't know about it.
  const { stageCategory, ...backendFilter } = filter;
  const { data: tasksRaw = [], isLoading, refetch } = useFilteredTasks(backendFilter);
  const tasks = stageCategory
    ? tasksRaw.filter(t => t.stageCategory === stageCategory)
    : tasksRaw;
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: technicians = [] } = useTechnicians();
  // Full admin catalog (any role) — needed to resolve the Reporter column,
  // since the reporter on a task is whoever created it (admin OR technician),
  // not only technicians. `technicians` (filtered to role=technician) stays
  // dedicated to the "Asignado a" select in CreateTaskModal.
  const { data: admins = [] } = useAdmins();
  const { data: templates = [] } = useTaskTemplates();
  const { data: priorities = [] } = useTaskPriorities();
  const createTask = useCreateTask();
  const [showCreate, setShowCreate] = useState(false);

  // Resolve the available stages for the bulk "Mover etapa" action: the workflow
  // of the project currently filtered. When no project filter is set the bulk
  // action is unavailable (button disables itself when stages list is empty).
  const selectedProject = filter.projectId
    ? projects.find(p => p.id === filter.projectId)
    : undefined;
  const availableStages = selectedProject?.workflowId
    ? workflows.find(w => w.id === selectedProject.workflowId)?.stages ?? []
    : [];

  // Column visibility — persisted in localStorage, only meaningful in table view
  const { visible: visibleColumns, toggle: toggleColumn, reorder: reorderColumns, reset: resetColumns } = useVisibleColumns(DEFAULT_VISIBLE_COLUMNS);

  return (
    <div className={styles.page}>
      {/* Header — mirror of SchedulingProjectsPage for visual consistency */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Tareas</h1>
        </div>
        <div className={styles.headerRight}>
          {view === 'table' && (
            <ColumnSelector
              columns={ALL_TASK_COLUMNS}
              visible={visibleColumns}
              onToggle={toggleColumn}
              onReorder={reorderColumns}
              onReset={resetColumns}
            />
          )}
          <button className={styles.btnIcon} title="Recargar" onClick={() => void refetch()}>
            <IconRefresh />
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)} disabled={projects.length === 0}>
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
            <TasksTableView
              tasks={tasks}
              loading={isLoading}
              availableStages={availableStages}
              projects={projects}
              workflows={workflows}
              priorities={priorities}
              admins={admins}
              visibleColumnKeys={visibleColumns}
            />
          ) : (
            <TasksKanbanView tasks={tasks} filter={filter} />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          workflows={workflows}
          technicians={technicians}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreate={data => createTask.mutateAsync(data)}
          loading={createTask.isPending}
        />
      )}
    </div>
  );
}
