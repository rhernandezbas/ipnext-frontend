import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useTasks } from '@/hooks/useScheduling';
import type { ScheduledTask } from '@/types/scheduling';
import styles from './SchedulingDashboardPage.module.css';

const COLUMNS = [
  { label: 'Título', key: 'title' as keyof ScheduledTask },
  { label: 'Categoría', key: 'category' as keyof ScheduledTask },
  { label: 'Estado', key: 'status' as keyof ScheduledTask },
  { label: 'Prioridad', key: 'priority' as keyof ScheduledTask },
  { label: 'Asignado a', key: 'assignedTo' as keyof ScheduledTask },
  { label: 'Fecha', key: 'scheduledDate' as keyof ScheduledTask },
];

export default function SchedulingDashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const totalTareas = tasks.length;
  const enProgreso = tasks.filter(t => t.status === 'in_progress').length;
  const completadas = tasks.filter(t => t.status === 'completed').length;
  const proyectosActivos = new Set(
    tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .map(t => t.category),
  ).size;

  const recentTasks = [...tasks]
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    .slice(0, 10);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard de Tareas</h1>

      <div className={styles.kpiGrid} aria-label="KPI cards">
        <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{totalTareas}</div>
          <div className={styles.kpiLabel}>Tareas totales</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#f59e0b' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{enProgreso}</div>
          <div className={styles.kpiLabel}>En progreso</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{completadas}</div>
          <div className={styles.kpiLabel}>Completadas</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#8b5cf6' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{proyectosActivos}</div>
          <div className={styles.kpiLabel}>Proyectos activos</div>
        </div>
      </div>

      <DataTable<ScheduledTask>
        columns={COLUMNS}
        data={recentTasks}
        loading={isLoading}
        emptyMessage="No hay tareas registradas."
      />
    </div>
  );
}
