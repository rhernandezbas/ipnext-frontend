import { useState } from 'react';
import { useTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useScheduling';
import type { ScheduledTask, TaskStatus, TaskPriority } from '@/types/scheduling';
import styles from './SchedulingPage.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────

function priorityClass(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    urgent: styles.priorityUrgent,
    high: styles.priorityHigh,
    normal: styles.priorityNormal,
    low: styles.priorityLow,
  };
  return map[priority] ?? styles.priorityNormal;
}

function priorityLabel(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    normal: 'Normal',
    low: 'Baja',
  };
  return map[priority] ?? priority;
}

function categoryLabel(cat: ScheduledTask['category']): string {
  const map: Record<ScheduledTask['category'], string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    other: 'Otro',
  };
  return map[cat] ?? cat;
}

function statusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };
  return map[status] ?? status;
}

// ── Task Form Modal ───────────────────────────────────────────────────────

interface TaskFormProps {
  onClose: () => void;
  onSubmit: (data: Omit<ScheduledTask, 'id'>) => void;
  initialData?: Omit<ScheduledTask, 'id'>;
  title?: string;
}

const EMPTY_TASK: Omit<ScheduledTask, 'id'> = {
  title: '',
  description: '',
  assignedTo: '',
  assignedToId: '',
  clientId: null,
  clientName: null,
  status: 'pending',
  priority: 'normal',
  scheduledDate: '',
  scheduledTime: '',
  estimatedHours: 1,
  address: '',
  coordinates: null,
  category: 'other',
  completedAt: null,
  notes: '',
};

function TaskFormModal({ onClose, onSubmit, initialData, title: modalTitle }: TaskFormProps) {
  const [form, setForm] = useState<Omit<ScheduledTask, 'id'>>(initialData ?? EMPTY_TASK);

  function handleChange<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <p className={styles.modalTitle}>{modalTitle ?? 'Nueva tarea'}</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="task-title">Título</label>
            <input
              id="task-title"
              type="text"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="task-description">Descripción</label>
            <textarea
              id="task-description"
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-assignedTo">Asignado a</label>
              <input
                id="task-assignedTo"
                type="text"
                value={form.assignedTo}
                onChange={e => handleChange('assignedTo', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="task-client">Cliente</label>
              <input
                id="task-client"
                type="text"
                value={form.clientName ?? ''}
                onChange={e => handleChange('clientName', e.target.value || null)}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-category">Categoría</label>
              <select
                id="task-category"
                value={form.category}
                onChange={e => handleChange('category', e.target.value as ScheduledTask['category'])}
              >
                <option value="installation">Instalación</option>
                <option value="repair">Reparación</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="inspection">Inspección</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="task-priority">Prioridad</label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={e => handleChange('priority', e.target.value as TaskPriority)}
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-date">Fecha</label>
              <input
                id="task-date"
                type="date"
                value={form.scheduledDate}
                onChange={e => handleChange('scheduledDate', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="task-time">Hora</label>
              <input
                id="task-time"
                type="time"
                value={form.scheduledTime}
                onChange={e => handleChange('scheduledTime', e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-hours">Horas estimadas</label>
              <input
                id="task-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={form.estimatedHours}
                onChange={e => handleChange('estimatedHours', Number(e.target.value))}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="task-address">Dirección</label>
            <input
              id="task-address"
              type="text"
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="task-notes">Notas</label>
            <textarea
              id="task-notes"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Guardar tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarView({ tasks }: { tasks: ScheduledTask[] }) {
  // Get the current week start (Monday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div data-testid="calendar-view" className={styles.calendarGrid}>
      {weekDates.map((date, i) => {
        const dateStr = date.toISOString().slice(0, 10);
        const dayTasks = tasks.filter(t => t.scheduledDate === dateStr);
        return (
          <div key={i} className={styles.calendarDay}>
            <div className={styles.calendarDayHeader}>
              {DAYS[i]} {date.getDate()}/{date.getMonth() + 1}
            </div>
            {dayTasks.map(t => (
              <div key={t.id} className={styles.calendarTask}>
                {t.scheduledTime} {t.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SchedulingPage() {
  const { data: tasks = [] } = useTasks();
  const { mutate: createTask } = useCreateTask();
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: updateStatus } = useUpdateTaskStatus();
  const { mutate: deleteTask } = useDeleteTask();

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');

  const filtered = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssigned && !t.assignedTo.toLowerCase().includes(filterAssigned.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Scheduling / Tareas</h1>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('list')}
            >
              Lista
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('calendar')}
            >
              Calendario
            </button>
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
            Nueva tarea
          </button>
        </div>
      </div>

      {showForm && (
        <TaskFormModal
          onClose={() => setShowForm(false)}
          onSubmit={data => createTask(data)}
        />
      )}

      {editingTask && (
        <TaskFormModal
          title="Editar tarea"
          initialData={(() => { const { id: _id, ...rest } = editingTask; return rest; })()}
          onClose={() => setEditingTask(null)}
          onSubmit={data => {
            updateTask({ id: editingTask.id, data });
            setEditingTask(null);
          }}
        />
      )}

      {view === 'list' && (
        <>
          <div className={styles.filterBar}>
            <select
              aria-label="Filtrar por estado"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Estado</option>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En progreso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>

            <select
              aria-label="Filtrar por prioridad"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="">Prioridad</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baja</option>
            </select>

            <input
              type="text"
              placeholder="Asignado a..."
              value={filterAssigned}
              onChange={e => setFilterAssigned(e.target.value)}
              aria-label="Filtrar por asignado"
            />
          </div>

          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Asignado a</th>
                  <th>Cliente</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{task.assignedTo}</td>
                    <td>{task.clientName ?? '—'}</td>
                    <td>
                      <span className={styles.categoryBadge}>
                        {categoryLabel(task.category)}
                      </span>
                    </td>
                    <td>
                      <span className={priorityClass(task.priority)}>
                        {priorityLabel(task.priority)}
                      </span>
                    </td>
                    <td>{statusLabel(task.status)}</td>
                    <td>{task.scheduledDate}</td>
                    <td>{task.scheduledTime}</td>
                    <td style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {task.status !== 'completed' && task.status !== 'cancelled' && (
                        <button
                          className={styles.btnPrimary}
                          onClick={() => updateStatus({ id: task.id, status: 'completed' })}
                          aria-label="Completar tarea"
                        >
                          Completar
                        </button>
                      )}
                      <button
                        className={styles.btnSecondary}
                        onClick={() => setEditingTask(task)}
                        aria-label="Editar tarea"
                      >
                        Editar
                      </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta tarea?')) {
                            deleteTask(task.id);
                          }
                        }}
                        aria-label="Eliminar tarea"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                      No hay tareas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'calendar' && <CalendarView tasks={tasks} />}
    </div>
  );
}
