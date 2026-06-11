import { useState } from 'react';
import { useFilteredTasks, useCreateTask } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import type { Project } from '@/types/project';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TasksTableView, ALL_TASK_COLUMNS } from './components/TasksTableView';
import { TasksKanbanView } from './components/TasksKanbanView';
import { ColumnSelector } from './components/ColumnSelector';
import { CreateTaskModal } from './components/CreateTaskModal';
import { useTasksFilterUrl } from './hooks/useTasksFilterUrl';
import { useVisibleColumns } from './hooks/useVisibleColumns';
import { Can } from '@/components/auth/Can';
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

export interface TasksPageBaseProps {
  /** Heading shown in the page header (e.g. "Tareas", "Tareas Nodos"). */
  title: string;
  /** Task kind constant merged into the backend filter. When set, the page only
   *  ever fetches tasks of this kind — the param is NOT user-editable nor in the URL. */
  kind?: 'customer' | 'network';
  /** Initial (and locked) mode for the CreateTaskModal. Hides the mode toggle. */
  modalDefaultMode?: 'customer' | 'network';
  /** Filters the project list passed to the CreateTaskModal select ONLY. The
   *  table keeps the full project list so it can resolve project labels for every
   *  task (network tasks still surface on the customer page's table and vice-versa). */
  projectPredicate?: (p: Project) => boolean;
  /** localStorage namespace for column visibility so sibling pages don't clash. */
  columnsStorageKey?: string;
  /** Empty-state copy for the table (#40 FIX-4). Defaults to the generic
   *  "No hay tareas para mostrar." when omitted. */
  emptyMessage?: string;
}

/**
 * Parameterized base for the scheduling task pages. The Tareas page and the
 * Tareas Nodos page are both thin wrappers around this component — bulk-move,
 * column visibility and refetch logic stay a single fix-point (#40).
 */
export function TasksPageBase({ title, kind, modalDefaultMode, projectPredicate, columnsStorageKey, emptyMessage }: TasksPageBaseProps) {
  const { filter, view, setFilter, setView } = useTasksFilterUrl();
  // stageCategory is a CLIENT-side filter — the backend doesn't know about it.
  const { stageCategory, ...backendFilter } = filter;
  // `kind` is a PAGE constant merged at fetch time — never URL state, never editable.
  const { data: tasksRaw = [], isLoading, refetch } = useFilteredTasks(kind ? { ...backendFilter, kind } : backendFilter);
  const tasks = stageCategory
    ? tasksRaw.filter(t => t.stageCategory === stageCategory)
    : tasksRaw;
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  // Single source of users: RbacUser catalog. `technicians` is derived by
  // role.code === 'tecnico' (CreateTaskModal's "Asignado a" select),
  // `admins` is the full list (Reporter resolution + Asignado-a in edit form).
  const { data: allRbacUsers = [] } = useRbacUsers();
  const admins = allRbacUsers;
  const technicians = allRbacUsers.filter(u => u.roles.some(r => r.code === 'tecnico'));
  const { data: templates = [] } = useTaskTemplates();
  const { data: priorities = [] } = useTaskPriorities();
  const createTask = useCreateTask();
  const [showCreate, setShowCreate] = useState(false);

  // Projects offered in the CREATE modal — filtered by the page predicate so the
  // customer page hides network projects and the node page shows only those. The
  // table below keeps the UNFILTERED list for label resolution.
  const modalProjects = projectPredicate ? projects.filter(projectPredicate) : projects;

  // Day-1 dead-end guard (#40 FIX-1): on the Nodos page, when there are zero
  // tagged network projects the "Añadir" button is disabled, so the modal hint
  // (the only guidance) is unreachable. Surface an ACTIONABLE inline hint near
  // the button so the operator knows how to unblock themselves. Gated on
  // `kind==='network'` — the customer page NEVER shows it.
  const showNoNetworkProjectsHint = kind === 'network' && modalProjects.length === 0;

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
  const { visible: visibleColumns, toggle: toggleColumn, reorder: reorderColumns, reset: resetColumns } = useVisibleColumns(DEFAULT_VISIBLE_COLUMNS, columnsStorageKey);

  return (
    <div className={styles.page}>
      {/* Header — mirror of SchedulingProjectsPage for visual consistency */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>{title}</h1>
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
          <Can permission="scheduling.write">
            <button className={styles.btnPrimary} onClick={() => setShowCreate(true)} disabled={modalProjects.length === 0}>
              <IconPlus /> Añadir
            </button>
          </Can>
        </div>
      </div>

      {/* Day-1 guidance banner (#40 FIX-1) — only on the Nodos page when no
          network project is configured. The Añadir button stays disabled; this
          banner tells the operator where to go to unblock themselves. */}
      {showNoNetworkProjectsHint && (
        <div className={styles.infoBanner} role="status">
          No hay proyectos de red configurados. Marcá un proyecto en Scheduling → Configuración → Proyectos de red.
        </div>
      )}

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
              emptyMessage={emptyMessage}
            />
          ) : (
            <TasksKanbanView tasks={tasks} filter={filter} />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          projects={modalProjects}
          workflows={workflows}
          technicians={technicians}
          templates={templates}
          defaultMode={modalDefaultMode}
          onClose={() => setShowCreate(false)}
          onCreate={data => createTask.mutateAsync(data)}
          loading={createTask.isPending}
        />
      )}
    </div>
  );
}
