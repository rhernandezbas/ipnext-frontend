import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SchedulingCalendarPage.module.css';
import { useCalendarUrlState } from './hooks/useCalendarUrlState';
import { useTasksForCalendar } from './hooks/useTasksForCalendar';
import { CalendarToolbar } from './components/CalendarToolbar';
import { CalendarMonthView } from './components/CalendarMonthView';
import { CalendarWeekView } from './components/CalendarWeekView';
import { CalendarDayView } from './components/CalendarDayView';
import { useTechnicians } from '@/hooks/useAdmins';
import { useProjects } from '@/hooks/useProjects';
import { useCreateTask } from '@/hooks/useScheduling';
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
    : task.scheduledDate
      ? new Date(`${task.scheduledDate}T${task.scheduledTime ?? '08:00'}:00`)
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
    customerName: task.customerName ?? task.clientName ?? undefined,
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

// ── Simple create-task modal stub ─────────────────────────────────────────────
interface CreatePreFill {
  startDate?: string;
  assigneeId?: string;
}

interface CreateModalProps {
  preFill: CreatePreFill;
  onClose: () => void;
}

function CreateTaskModal({ preFill, onClose }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const createTask = useCreateTask();

  async function handleSave() {
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title: title.trim(),
      description: null,
      assignedTo: null,
      assignedToId: null,
      clientId: null,
      clientName: null,
      stageId: '10000000-0000-4000-a000-000000000001',
      priority: 'normal',
      scheduledDate: null,
      scheduledTime: null,
      estimatedHours: 1,
      address: null,
      coordinates: null,
      category: 'installation',
      projectId: null,
      projectName: null,
      completedAt: null,
      notes: null,
      stageCategory: 'nuevo',
      status: 'pending',
      startDate: preFill.startDate ?? null,
      endDate: null,
      customerId: null,
      customerName: null,
      serviceId: null,
      partnerId: null,
      reporterId: null,
      assigneeId: preFill.assigneeId ?? null,
      assigneeName: null,
      watcherIds: [],
      travelTimeTo: null,
      travelTimeFrom: null,
      checklist: [],
    });
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Crear tarea"
    >
      <div
        style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 28, width: 440, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nueva tarea</h2>
        {preFill.startDate && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Fecha: {new Date(preFill.startDate).toLocaleString('es-AR')}
          </p>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Título *
          <input
            style={{ padding: '10px 12px', border: '1px solid var(--color-gray-300)', borderRadius: 'var(--radius-md)', fontSize: 14, outline: 'none' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre de la tarea"
            autoFocus
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={() => void handleSave()} disabled={!title.trim() || createTask.isPending}>
            {createTask.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
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
  const { data: admins = [] } = useTechnicians();
  const { data: projects = [] } = useProjects();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPreFill, setCreatePreFill] = useState<CreatePreFill>({});
  const [showFilters, setShowFilters] = useState(false);

  const events: CalendarEvent[] = useMemo(
    () => rawTasks.map(toCalendarEvent),
    [rawTasks]
  );

  const resources: CalendarResource[] = useMemo(
    () => admins.map(toCalendarResource),
    [admins]
  );

  function handleEventClick(id: string) {
    navigate(`/admin/scheduling/tasks/${id}`);
  }

  function handleSlotClick(slotDate: Date, resourceId: string) {
    setCreatePreFill({ startDate: slotDate.toISOString(), assigneeId: resourceId !== 'unassigned' ? resourceId : undefined });
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

      {/* Create task modal */}
      {showCreateModal && (
        <CreateTaskModal
          preFill={createPreFill}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
