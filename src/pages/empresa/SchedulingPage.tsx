import { useState } from 'react';
import { useTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useScheduling';
import type { ScheduledTask, TaskStatus, TaskPriority } from '@/types/scheduling';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import styles from './SchedulingPage.module.css';

// ── Label maps ────────────────────────────────────────────────

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baja',
};

const CATEGORY_LABEL: Record<ScheduledTask['category'], string> = {
  installation: 'Instalación', repair: 'Reparación',
  maintenance: 'Mantenimiento', inspection: 'Inspección', other: 'Otro',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente', in_progress: 'En progreso',
  completed: 'Completada', cancelled: 'Cancelada',
};

// ── Style helpers ─────────────────────────────────────────────

function statusClass(s: TaskStatus): string {
  return {
    pending:     styles.statusPending,
    in_progress: styles.statusProgress,
    completed:   styles.statusDone,
    cancelled:   styles.statusCancelled,
  }[s] ?? '';
}

function priorityClass(p: TaskPriority): string {
  return {
    urgent: styles.priorityUrgent,
    high:   styles.priorityHigh,
    normal: styles.priorityNormal,
    low:    styles.priorityLow,
  }[p] ?? '';
}

function catDotClass(c: ScheduledTask['category']): string {
  return {
    installation: styles.catInstall,
    repair:       styles.catRepair,
    maintenance:  styles.catMaint,
    inspection:   styles.catInspect,
    other:        styles.catOther,
  }[c] ?? '';
}

function chipClass(c: ScheduledTask['category']): string {
  return {
    installation: styles.chipInstall,
    repair:       styles.chipRepair,
    maintenance:  styles.chipMaint,
    inspection:   styles.chipInspect,
    other:        styles.chipOther,
  }[c] ?? '';
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Form modal ────────────────────────────────────────────────

const EMPTY: Omit<ScheduledTask, 'id'> = {
  title: '', description: '', assignedTo: '', assignedToId: '',
  clientId: null, clientName: null, status: 'pending', priority: 'normal',
  scheduledDate: '', scheduledTime: '', estimatedHours: 1,
  address: '', coordinates: null, category: 'other',
  projectId: null, projectName: null, completedAt: null, notes: '',
};

interface TaskFormProps {
  title?: string;
  initial?: Omit<ScheduledTask, 'id'>;
  onClose: () => void;
  onSubmit: (data: Omit<ScheduledTask, 'id'>) => void;
}

function TaskModal({ title = 'Nueva tarea', initial, onClose, onSubmit }: TaskFormProps) {
  const [form, setForm] = useState<Omit<ScheduledTask, 'id'>>(initial ?? EMPTY);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
    onClose();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>{title}</p>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className={styles.modalBody}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="f-title">Título</label>
              <input
                id="f-title" className={styles.formControl} type="text"
                value={form.title} onChange={e => set('title', e.target.value)} required
                placeholder="Ej: Instalación fibra óptica — García"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="f-desc">Descripción</label>
              <textarea
                id="f-desc" className={styles.formControl}
                value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Detalles de la tarea..."
              />
            </div>

            <div className={styles.formDivider} />
            <p className={styles.formSection}>Asignación</p>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-assigned">Asignado a</label>
                <input
                  id="f-assigned" className={styles.formControl} type="text"
                  value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}
                  placeholder="Nombre del técnico"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-client">Cliente</label>
                <input
                  id="f-client" className={styles.formControl} type="text"
                  value={form.clientName ?? ''}
                  onChange={e => set('clientName', e.target.value || null)}
                  placeholder="Nombre del cliente (opcional)"
                />
              </div>
            </div>

            <div className={styles.formDivider} />
            <p className={styles.formSection}>Clasificación</p>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-cat">Categoría</label>
                <select id="f-cat" className={styles.formControl}
                  value={form.category} onChange={e => set('category', e.target.value as ScheduledTask['category'])}>
                  <option value="installation">Instalación</option>
                  <option value="repair">Reparación</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="inspection">Inspección</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-priority">Prioridad</label>
                <select id="f-priority" className={styles.formControl}
                  value={form.priority} onChange={e => set('priority', e.target.value as TaskPriority)}>
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className={styles.formDivider} />
            <p className={styles.formSection}>Programación</p>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-date">Fecha</label>
                <input id="f-date" className={styles.formControl} type="date"
                  value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-time">Hora</label>
                <input id="f-time" className={styles.formControl} type="time"
                  value={form.scheduledTime} onChange={e => set('scheduledTime', e.target.value)} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-hours">Horas estimadas</label>
                <input id="f-hours" className={styles.formControl} type="number" min={0.5} step={0.5}
                  value={form.estimatedHours} onChange={e => set('estimatedHours', Number(e.target.value))} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-address">Dirección</label>
                <input id="f-address" className={styles.formControl} type="text"
                  value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="Dirección del trabajo" />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="f-notes">Notas</label>
              <textarea id="f-notes" className={styles.formControl}
                value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Instrucciones adicionales, materiales necesarios..." />
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
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────

function ListView({
  tasks,
  onEdit,
  onComplete,
  onDelete,
}: {
  tasks: ScheduledTask[];
  onEdit: (t: ScheduledTask) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Técnico</th>
            <th>Categoría</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td>
                <div className={styles.taskTitle}>{t.title}</div>
                {t.address && <div className={styles.taskAddress}>📍 {t.address}</div>}
              </td>
              <td>
                <div className={styles.assignee}>
                  <span className={styles.assigneeAvatar}>{initials(t.assignedTo)}</span>
                  {t.assignedTo}
                </div>
              </td>
              <td>
                <span className={styles.categoryBadge}>
                  <span className={`${styles.catDot} ${catDotClass(t.category)}`} />
                  {CATEGORY_LABEL[t.category]}
                </span>
              </td>
              <td>
                <span className={`${styles.badge} ${priorityClass(t.priority)}`}>
                  {PRIORITY_LABEL[t.priority]}
                </span>
              </td>
              <td>
                <span className={`${styles.badge} ${statusClass(t.status)}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </td>
              <td>{fmtDate(t.scheduledDate)}<br /><small style={{ color: 'var(--text-3)' }}>{t.scheduledTime}</small></td>
              <td>
                <KebabMenu items={[
                  ...(t.status !== 'completed' && t.status !== 'cancelled' ? [{
                    label: 'Completar',
                    onClick: () => onComplete(t.id),
                  }] : []),
                  { label: 'Editar', onClick: () => onEdit(t) },
                  { label: 'Eliminar', onClick: () => { if (window.confirm('¿Eliminar esta tarea?')) onDelete(t.id); } },
                ]} />
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr className={styles.emptyRow}>
              <td colSpan={7}>
                <span className={styles.emptyIcon}>📋</span>
                No hay tareas que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Kanban view ───────────────────────────────────────────────

const KANBAN_COLS: { status: TaskStatus; label: string; dotColor: string }[] = [
  { status: 'pending',     label: 'Pendiente',   dotColor: 'var(--s-pending-fg)'   },
  { status: 'in_progress', label: 'En progreso', dotColor: 'var(--s-progress-fg)'  },
  { status: 'completed',   label: 'Completada',  dotColor: 'var(--s-done-fg)'      },
  { status: 'cancelled',   label: 'Cancelada',   dotColor: 'var(--s-cancelled-fg)' },
];

function KanbanView({
  tasks,
  onEdit,
  onComplete,
}: {
  tasks: ScheduledTask[];
  onEdit: (t: ScheduledTask) => void;
  onComplete: (id: string) => void;
}) {
  return (
    <div className={styles.kanban}>
      {KANBAN_COLS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} className={styles.kanbanCol}>
            <div className={styles.kanbanHeader}>
              <span className={styles.kanbanTitle}>
                <span className={styles.kanbanDot} style={{ background: col.dotColor }} />
                {col.label}
              </span>
              <span className={styles.kanbanCount}>{colTasks.length}</span>
            </div>
            <div className={styles.kanbanCards}>
              {colTasks.length === 0 && (
                <div className={styles.kanbanEmpty}>Sin tareas</div>
              )}
              {colTasks.map(t => (
                <div key={t.id} className={styles.kanbanCard}>
                  <div className={styles.kanbanCardTitle}>{t.title}</div>
                  <div className={styles.kanbanCardFooter}>
                    <span className={`${styles.badge} ${priorityClass(t.priority)}`}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                    <span className={styles.categoryBadge}>
                      <span className={`${styles.catDot} ${catDotClass(t.category)}`} />
                      {CATEGORY_LABEL[t.category]}
                    </span>
                  </div>
                  <div className={styles.kanbanCardMeta} style={{ marginTop: 8 }}>
                    <span className={styles.kanbanCardAssignee}>
                      <span className={styles.assigneeAvatar} style={{ fontSize: 9, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        {initials(t.assignedTo)}
                      </span>{' '}
                      {t.assignedTo}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {t.status !== 'completed' && t.status !== 'cancelled' && (
                        <button className={styles.btnGhost} onClick={() => onComplete(t.id)} aria-label="Completar">✓</button>
                      )}
                      <button className={styles.btnGhost} onClick={() => onEdit(t)} aria-label="Editar">✎</button>
                    </div>
                  </div>
                  {t.scheduledDate && (
                    <div className={styles.kanbanCardDate} style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                      📅 {fmtDate(t.scheduledDate)} {t.scheduledTime}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar view (weekly) ────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarView({ tasks }: { tasks: ScheduledTask[] }) {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className={styles.calendarWeek}>
      <div className={styles.calendarWeekHeader}>
        <div style={{ padding: '12px 8px' }} />
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().slice(0, 10);
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className={`${styles.calendarDayCol} ${isToday ? styles.calendarDayToday : ''}`}>
              <div className={styles.calendarDayName}>{DAY_NAMES[i]}</div>
              <div className={styles.calendarDayDate}>{date.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.calendarBody}>
        <div />
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().slice(0, 10);
          const dayTasks = tasks.filter(t => t.scheduledDate === dateStr);
          return (
            <div key={i} className={styles.calendarCell}>
              {dayTasks.map(t => (
                <span key={t.id} className={`${styles.calendarTaskChip} ${chipClass(t.category)}`}
                  title={`${t.scheduledTime} — ${t.title} (${t.assignedTo})`}>
                  {t.scheduledTime} {t.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

type View = 'list' | 'kanban' | 'calendar';

export default function SchedulingPage() {
  const { data: tasks = [] } = useTasks();
  const { mutate: createTask }   = useCreateTask();
  const { mutate: updateTask }   = useUpdateTask();
  const { mutate: updateStatus } = useUpdateTaskStatus();
  const { mutate: deleteTask }   = useDeleteTask();

  const [view, setView]             = useState<View>('list');
  const [showForm, setShowForm]     = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');

  const filtered = tasks.filter(t => {
    if (filterStatus   && t.status !== filterStatus)     return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterAssigned && !t.assignedTo.toLowerCase().includes(filterAssigned.toLowerCase())) return false;
    return true;
  });

  // Stats
  const pending    = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed  = tasks.filter(t => t.status === 'completed').length;
  const cancelled  = tasks.filter(t => t.status === 'cancelled').length;

  function handleComplete(id: string) {
    updateStatus({ id, status: 'completed' });
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Scheduling</h1>
          <p className={styles.subtitle}>
            {tasks.length} registradas · {pending} pendientes · {inProgress} en progreso
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.viewSwitcher}>
            {(['list', 'kanban', 'calendar'] as View[]).map(v => (
              <button key={v} className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
                onClick={() => setView(v)}>
                {{ list: '≡ Lista', kanban: '⊞ Kanban', calendar: '📅 Calendario' }[v]}
              </button>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <div className={`${styles.statValue} ${styles.colorPending}`}>{pending}</div>
          <div className={styles.statLabel}>
            <span className={styles.statDot} style={{ background: 'var(--s-pending-fg)' }} />
            Pendientes
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={`${styles.statValue} ${styles.colorProgress}`}>{inProgress}</div>
          <div className={styles.statLabel}>
            <span className={styles.statDot} style={{ background: 'var(--s-progress-fg)' }} />
            En progreso
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={`${styles.statValue} ${styles.colorDone}`}>{completed}</div>
          <div className={styles.statLabel}>
            <span className={styles.statDot} style={{ background: 'var(--s-done-fg)' }} />
            Completadas
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={`${styles.statValue} ${styles.colorCancel}`}>{cancelled}</div>
          <div className={styles.statLabel}>
            <span className={styles.statDot} style={{ background: 'var(--s-cancelled-fg)' }} />
            Canceladas
          </div>
        </div>
      </div>

      {/* Filters */}
      {view !== 'calendar' && (
        <div className={styles.filterBar}>
          <select className={styles.filterSelect} aria-label="Filtrar por estado"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <select className={styles.filterSelect} aria-label="Filtrar por prioridad"
            value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baja</option>
          </select>

          <select className={styles.filterSelect} aria-label="Filtrar por categoría"
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            <option value="installation">Instalación</option>
            <option value="repair">Reparación</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="inspection">Inspección</option>
            <option value="other">Otro</option>
          </select>

          <input className={styles.filterInput} type="text" placeholder="Buscar técnico..."
            aria-label="Filtrar por técnico" value={filterAssigned}
            onChange={e => setFilterAssigned(e.target.value)} />

          <span className={styles.filterCount}>
            {filtered.length} de {tasks.length}
          </span>
        </div>
      )}

      {/* Views */}
      {view === 'list' && (
        <ListView tasks={filtered} onEdit={setEditingTask}
          onComplete={handleComplete} onDelete={id => deleteTask(id)} />
      )}

      {view === 'kanban' && (
        <KanbanView tasks={filtered} onEdit={setEditingTask} onComplete={handleComplete} />
      )}

      {view === 'calendar' && <CalendarView tasks={tasks} />}

      {/* Modals */}
      {showForm && (
        <TaskModal onClose={() => setShowForm(false)} onSubmit={data => createTask(data)} />
      )}

      {editingTask && (
        <TaskModal
          title="Editar tarea"
          initial={(() => { const { id: _id, ...rest } = editingTask; return rest; })()}
          onClose={() => setEditingTask(null)}
          onSubmit={data => { updateTask({ id: editingTask.id, data }); setEditingTask(null); }}
        />
      )}
    </div>
  );
}
