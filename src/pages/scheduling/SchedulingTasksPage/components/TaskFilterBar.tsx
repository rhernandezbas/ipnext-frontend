import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflow } from '@/hooks/useWorkflows';
import { usePartners } from '@/hooks/usePartners';
import { useAdmins } from '@/hooks/useAdmins';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import type { TaskListFilter, TasksView } from '@/types/scheduling';
import type { Project } from '@/types/project';
import styles from './TaskFilterBar.module.css';

interface TaskFilterBarProps {
  filter: TaskListFilter;
  view: TasksView;
  onFilterChange: (patch: Partial<TaskListFilter>) => void;
  onViewChange: (v: TasksView) => void;
}

function StageMultiSelect({
  workflowId,
  selectedIds,
  onChange,
}: {
  workflowId: string | null | undefined;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: workflow } = useWorkflow(workflowId);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const stages = workflow?.stages ?? [];
  const groups = [
    { label: 'Nuevo',       cat: 'nuevo',      items: stages.filter(s => s.category === 'nuevo') },
    { label: 'En progreso', cat: 'enProgreso',  items: stages.filter(s => s.category === 'enProgreso') },
    { label: 'Hecho',       cat: 'hecho',       items: stages.filter(s => s.category === 'hecho') },
  ];

  const totalSelected = selectedIds.length;
  const total = stages.length;
  const label = total === 0
    ? 'Estados'
    : totalSelected === 0
      ? 'Todos los estados'
      : `${totalSelected} de ${total} seleccionados`;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div ref={ref} className={styles.stageMultiSelect}>
      <button
        type="button"
        className={styles.stageButton}
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label} ▾
      </button>
      {open && (
        <div className={styles.stageDropdown} role="listbox" aria-multiselectable="true">
          {groups.map(group => group.items.length > 0 && (
            <div key={group.cat} className={styles.stageGroup}>
              <span className={styles.stageGroupLabel}>{group.label}</span>
              {group.items.map(stage => (
                <label key={stage.id} className={styles.stageOption}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(stage.id)}
                    onChange={() => toggle(stage.id)}
                  />
                  {stage.name}
                </label>
              ))}
            </div>
          ))}
          {stages.length === 0 && (
            <span className={styles.stageEmpty}>Seleccioná un proyecto para ver estados</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskFilterBar({ filter, view, onFilterChange, onViewChange }: TaskFilterBarProps) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: partners = [] } = usePartners();
  const { data: admins = [] } = useAdmins();
  const { data: priorities = [] } = useTaskPriorities();
  const selectedProject: Project | undefined = projects.find(p => p.id === filter.projectId);

  // Debounced q value
  const [qInput, setQInput] = useState(filter.q ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQInput(filter.q ?? '');
  }, [filter.q]);

  function handleQChange(val: string) {
    setQInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ q: val || undefined });
    }, 300);
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.controls}>
        {/* Project select */}
        <select
          value={filter.projectId ?? ''}
          onChange={e => onFilterChange({ projectId: e.target.value || undefined, stageIds: [] })}
          className={styles.select}
          aria-label="Proyecto"
        >
          <option value="">Todos los proyectos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Stage multi-select */}
        <StageMultiSelect
          workflowId={selectedProject?.workflowId}
          selectedIds={filter.stageIds ?? []}
          onChange={ids => onFilterChange({ stageIds: ids })}
        />

        {/* Partner select */}
        <select
          value={filter.partnerId ?? ''}
          onChange={e => onFilterChange({ partnerId: e.target.value || undefined })}
          className={styles.select}
          aria-label="Socio"
        >
          <option value="">Todos los socios</option>
          {partners.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Assignee select */}
        <select
          value={filter.assigneeId ?? ''}
          onChange={e => onFilterChange({ assigneeId: e.target.value || undefined })}
          className={styles.select}
          aria-label="Asignado"
        >
          <option value="">Cualquier asignado</option>
          {admins.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Priority select */}
        <select
          value={filter.priority ?? ''}
          onChange={e => onFilterChange({ priority: e.target.value || undefined })}
          className={styles.select}
          aria-label="Prioridad"
        >
          <option value="">Cualquier prioridad</option>
          {priorities.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>

        {/* Search input */}
        <input
          type="search"
          value={qInput}
          onChange={e => handleQChange(e.target.value)}
          placeholder="Buscar tareas..."
          className={styles.searchInput}
          aria-label="Buscar tareas"
        />

        {/* Spacer */}
        <div className={styles.spacer} />

        {/* View toggle */}
        <div className={styles.viewToggle} role="group" aria-label="Vista">
          <button
            type="button"
            className={[styles.viewBtn, view === 'table' ? styles.viewBtnActive : ''].join(' ')}
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Vista de la tabla"
          >
            <span aria-hidden>⊞</span> Tabla
          </button>
          <button
            type="button"
            className={[styles.viewBtn, view === 'kanban' ? styles.viewBtnActive : ''].join(' ')}
            onClick={() => onViewChange('kanban')}
            aria-pressed={view === 'kanban'}
            aria-label="Flujo de Trabajo"
          >
            <span aria-hidden>☰</span> Flujo de Trabajo
          </button>
        </div>

        {/* Add button — moved to the page header (consistent with SchedulingProjectsPage) */}
        <button
          type="button"
          className={styles.addBtn}
          style={{ display: 'none' }}
          onClick={() => navigate('/admin/scheduling/tasks/new')}
        >
          + Añadir
        </button>
      </div>

      {/* Active filter chips */}
      <ActiveFilterChips
        filter={filter}
        projects={projects}
        partners={partners}
        admins={admins}
        onFilterChange={onFilterChange}
      />
    </div>
  );
}

interface ActiveFilterChipsProps {
  filter: TaskListFilter;
  projects: Project[];
  partners: Array<{ id: string; name: string }>;
  admins: Array<{ id: string; name: string }>;
  onFilterChange: (patch: Partial<TaskListFilter>) => void;
}

function ActiveFilterChips({ filter, projects, partners, admins, onFilterChange }: ActiveFilterChipsProps) {
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filter.projectId) {
    const project = projects.find(p => p.id === filter.projectId);
    chips.push({
      label: project?.title ?? filter.projectId,
      onRemove: () => onFilterChange({ projectId: undefined, stageIds: [] }),
    });
  }

  if (filter.partnerId) {
    const partner = partners.find(p => p.id === filter.partnerId);
    chips.push({
      label: `Socio: ${partner?.name ?? filter.partnerId}`,
      onRemove: () => onFilterChange({ partnerId: undefined }),
    });
  }

  if (filter.assigneeId) {
    const admin = admins.find(a => a.id === filter.assigneeId);
    chips.push({
      label: `Asignado: ${admin?.name ?? filter.assigneeId}`,
      onRemove: () => onFilterChange({ assigneeId: undefined }),
    });
  }

  if (filter.priority) {
    chips.push({
      label: `Prioridad: ${filter.priority}`,
      onRemove: () => onFilterChange({ priority: undefined }),
    });
  }

  if (filter.q) {
    chips.push({ label: `"${filter.q}"`, onRemove: () => onFilterChange({ q: undefined }) });
  }

  if (chips.length === 0) return null;

  return (
    <ul className={styles.chipList} aria-label="Filtros activos">
      {chips.map(chip => (
        <li key={chip.label} className={styles.chip}>
          <span>{chip.label}</span>
          <button
            type="button"
            className={styles.chipRemove}
            onClick={chip.onRemove}
            aria-label={`Quitar filtro ${chip.label}`}
          >
            ×
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className={styles.clearAll}
          onClick={() => onFilterChange({ projectId: undefined, stageIds: [], q: undefined, partnerId: undefined, assigneeId: undefined, priority: undefined })}
        >
          Limpiar todo
        </button>
      </li>
    </ul>
  );
}
