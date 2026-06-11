import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SchedulingCalendarPage.module.css';
import { useCalendarUrlState } from './hooks/useCalendarUrlState';
import { useTasksForCalendar } from './hooks/useTasksForCalendar';
import { CalendarToolbar } from './components/CalendarToolbar';
import { CalendarMonthView } from './components/CalendarMonthView';
import { CalendarWeekView } from './components/CalendarWeekView';
import { CalendarDayView } from './components/CalendarDayView';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useCreateTask } from '@/hooks/useScheduling';
import { CreateTaskModal } from '../SchedulingTasksPage/components/CreateTaskModal';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';
import type { ScheduledTask } from '@/types/scheduling';

// ── Icon ──────────────────────────────────────────────────────────────────────
function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toCalendarEvent(task: ScheduledTask): CalendarEvent {
  const start = task.startDate
    ? new Date(task.startDate)
    : new Date();

  const end = task.endDate
    ? new Date(task.endDate)
    : new Date(start.getTime() + (task.estimatedHours || 1) * 60 * 60 * 1000);

  return {
    id: task.id,
    title: task.title,
    start,
    end,
    resourceId: task.assigneeId ?? 'unassigned',
    stageCategory: task.stageCategory === 'cancelado' ? 'hecho' : task.stageCategory,
    customerName: task.customerName ?? undefined,
    address: task.address ?? undefined,
  };
}

function toCalendarResource(admin: { id: string; name: string; role?: string }): CalendarResource {
  const words = admin.name.trim().split(/\s+/);
  const initials = words.slice(0, 3).map(w => w[0]?.toUpperCase() ?? '').join('');
  return {
    id: admin.id,
    name: admin.name,
    initials,
    role: admin.role ?? 'technician',
  };
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ── Create-task prefill ───────────────────────────────────────────────────────
// Soft fields seeded from a calendar slot click. NEVER includes the required
// contract — the real CreateTaskModal forces the operator to pick one, which is
// what prevents the BE 400 the inline stub used to trigger.
interface CreatePreFill {
  /** Local "YYYY-MM-DDTHH:mm" string for the datetime-local input. */
  startDate?: string;
  assigneeId?: string;
}

/** Format a Date as "YYYY-MM-DDTHH:mm" in LOCAL time (datetime-local format). */
function toLocalInputString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulingCalendarPage() {
  const navigate = useNavigate();
  const {
    view, date, from, to, filter, fullDay,
    setView, setDate, setFilter, toggleFullDay,
    goNext, goPrev, goToday, periodLabel,
  } = useCalendarUrlState();

  const { data: rawTasks = [], isLoading, refetch } = useTasksForCalendar(filter, from, to);
  const { data: rbacUsers = [] } = useRbacUsers();
  const { data: projects = [] } = useProjects();
  const { data: workflows = [] } = useWorkflows();
  const { data: templates = [] } = useTaskTemplates();
  const createTask = useCreateTask();

  // Same derivation as SchedulingTasksPage: technicians are RbacUsers with the
  // 'tecnico' role (the modal's "Asignado a" select).
  const technicians = useMemo(
    () => rbacUsers.filter(u => u.roles.some(r => r.code === 'tecnico')),
    [rbacUsers],
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPreFill, setCreatePreFill] = useState<CreatePreFill>({});
  const [showFilters, setShowFilters] = useState(false);

  const events: CalendarEvent[] = useMemo(
    () => rawTasks.map(toCalendarEvent),
    [rawTasks]
  );

  const resources: CalendarResource[] = useMemo(
    () =>
      rbacUsers
        .filter(u => u.roles.some(r => r.code === 'tecnico'))
        .map(toCalendarResource),
    [rbacUsers]
  );

  function handleEventClick(id: string) {
    navigate(`/admin/scheduling/tasks/${id}`);
  }

  function handleSlotClick(slotDate: Date, resourceId: string) {
    setCreatePreFill({
      startDate: toLocalInputString(slotDate),
      assigneeId: resourceId !== 'unassigned' ? resourceId : undefined,
    });
    setShowCreateModal(true);
  }

  const isEmpty = !isLoading && events.length === 0;

  return (
    <div className={styles.page}>
      {/* Header — mirrors SchedulingProjectsPage exactly */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Calendario</h1>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.btnIcon}
            title="Recargar"
            onClick={() => void refetch()}
          >
            <IconRefresh />
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => { setCreatePreFill({}); setShowCreateModal(true); }}
          >
            Añadir tarea
          </button>
          <button
            className={`${styles.btnSecondary} ${showFilters ? styles.btnSecondaryActive : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <IconFilter /> Filtrar
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <CalendarToolbar
        view={view}
        onViewChange={setView}
        periodLabel={periodLabel}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        filter={filter}
        onFilterChange={setFilter}
        projects={projects}
        fullDay={fullDay}
        onToggleFullDay={toggleFullDay}
        showFullDayToggle={view === 'day'}
      />

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.calendarSection}>
          {isEmpty && view !== 'month' ? (
            <div className={styles.emptyState}>
              <IconCalendar />
              <span>Sin tareas en este rango.</span>
              <span style={{ fontSize: 13 }}>Cargá una nueva o ajustá los filtros.</span>
              <button
                className={styles.btnPrimary}
                onClick={() => { setCreatePreFill({}); setShowCreateModal(true); }}
              >
                + Añadir tarea
              </button>
            </div>
          ) : null}

          {view === 'month' && (
            <CalendarMonthView
              year={date.getFullYear()}
              month={date.getMonth()}
              events={events}
              onEventClick={handleEventClick}
              onDayClick={d => handleSlotClick(d, 'unassigned')}
              onMoreClick={d => { setDate(d); setView('day'); }}
              isLoading={isLoading}
            />
          )}

          {view === 'week' && !isEmpty && (
            <CalendarWeekView
              weekStart={getWeekStart(date)}
              resources={resources}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              isLoading={isLoading}
            />
          )}

          {view === 'week' && isLoading && (
            <CalendarWeekView
              weekStart={getWeekStart(date)}
              resources={resources}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              isLoading={isLoading}
            />
          )}

          {view === 'day' && !isEmpty && (
            <CalendarDayView
              date={date}
              resources={resources}
              events={events}
              fullDay={fullDay}
              onEventClick={handleEventClick}
              onSlotClick={(d, hour, rid) =>
                handleSlotClick(
                  new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0),
                  rid
                )
              }
              isLoading={isLoading}
            />
          )}

          {view === 'day' && isLoading && (
            <CalendarDayView
              date={date}
              resources={resources}
              events={events}
              fullDay={fullDay}
              onEventClick={handleEventClick}
              onSlotClick={(d, hour, rid) =>
                handleSlotClick(
                  new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0),
                  rid
                )
              }
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className={styles.filterPanel}>
            <h3 className={styles.filterTitle}>Filtros</h3>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Proyecto</label>
              <select
                className={styles.filterInput}
                value={filter.projectId ?? ''}
                onChange={e => setFilter({ projectId: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setFilter({ projectId: undefined, partnerId: undefined, assigneeId: undefined })}
              >
                Limpiar
              </button>
              <button className={styles.btnPrimary} onClick={() => setShowFilters(false)}>
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create task modal — full form, enforces the required contract so we never
          fire a create without one (the source of the old uncaught 400). */}
      {showCreateModal && (
        <CreateTaskModal
          projects={projects.filter(p => !p.isNetworkProject)}
          workflows={workflows}
          technicians={technicians}
          templates={templates}
          loading={createTask.isPending}
          initialValues={{
            startDate: createPreFill.startDate,
            assigneeId: createPreFill.assigneeId,
          }}
          onCreate={data => createTask.mutateAsync(data)}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
