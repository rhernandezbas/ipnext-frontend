import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useTasks } from '@/hooks/useScheduling';
import type { ScheduledTask } from '@/types/scheduling';
import styles from './SchedulingDashboardPage.module.css';

const COLUMNS = [
  { label: 'Título',     key: 'title' as keyof ScheduledTask },
  { label: 'Categoría', key: 'category' as keyof ScheduledTask },
  { label: 'Estado',    key: 'status' as keyof ScheduledTask },
  { label: 'Prioridad', key: 'priority' as keyof ScheduledTask },
  { label: 'Técnico',   key: 'assignedTo' as keyof ScheduledTask },
  { label: 'Fecha',     key: 'scheduledDate' as keyof ScheduledTask },
];

interface KpiCardProps {
  value: number;
  label: string;
  color: string;
  icon: string;
}

function KpiCard({ value, label, color, icon }: KpiCardProps) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-color': color } as React.CSSProperties}>
      <span className={styles.kpiIcon}>{icon}</span>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

export default function SchedulingDashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const total     = tasks.length;
  const progress  = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const urgent    = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'cancelled').length;

  const recent = [...tasks]
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    .slice(0, 10);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard de Scheduling</h1>

      <div className={styles.kpiGrid} aria-label="KPI cards">
        <KpiCard value={total}     label="Tareas totales"  color="oklch(56% 0.2 25)"   icon="📋" />
        <KpiCard value={progress}  label="En progreso"     color="oklch(38% 0.18 230)"  icon="⚙️" />
        <KpiCard value={completed} label="Completadas"     color="oklch(34% 0.15 148)"  icon="✅" />
        <KpiCard value={urgent}    label="Urgentes activas" color="oklch(40% 0.22 25)"  icon="🔴" />
      </div>

      <DataTable<ScheduledTask>
        columns={COLUMNS}
        data={recent}
        loading={isLoading}
        emptyMessage="No hay tareas registradas."
      />
    </div>
  );
}
