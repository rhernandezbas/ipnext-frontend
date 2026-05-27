import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useTasks } from '@/hooks/useScheduling';
import type { ScheduledTask } from '@/types/scheduling';
import styles from './SchedulingDashboardPage.module.css';

const COLUMNS = [
  { label: 'Título',     key: 'title' as keyof ScheduledTask },
  { label: 'Categoría',  key: 'category' as keyof ScheduledTask },
  { label: 'Estado',     key: 'stageCategory' as keyof ScheduledTask },
  { label: 'Prioridad',  key: 'priority' as keyof ScheduledTask },
  { label: 'Técnico',    key: 'assigneeName' as keyof ScheduledTask },
  { label: 'Fecha',      key: 'startDate' as keyof ScheduledTask },
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
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon} aria-hidden>{icon}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
    </div>
  );
}

export default function SchedulingDashboardPage() {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useTasks();

  const total     = tasks.length;
  const progress  = tasks.filter(t => t.stageCategory === 'enProgreso').length;
  const completed = tasks.filter(t => t.stageCategory === 'hecho').length;
  const urgent    = tasks.filter(t => t.priority === 'urgent' && t.stageCategory !== 'hecho' && t.stageCategory !== 'cancelado').length;

  const recent = [...tasks]
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
    .slice(0, 10);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
      </div>

      <div className={styles.kpiGrid} aria-label="KPI cards">
        <KpiCard value={total}     label="Tareas totales"   color="var(--color-text-primary)" icon="📋" />
        <KpiCard value={progress}  label="En progreso"      color="#1e40af"                   icon="⚙️" />
        <KpiCard value={completed} label="Completadas"      color="#166534"                   icon="✅" />
        <KpiCard value={urgent}    label="Urgentes activas" color="#991b1b"                   icon="🔴" />
      </div>

      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>Tareas recientes</h2>
        <DataTable<ScheduledTask>
          columns={COLUMNS}
          data={recent}
          loading={isLoading}
          emptyMessage="No hay tareas registradas."
          actions={[
            { label: 'Ver detalle', onClick: (t) => navigate(`/admin/scheduling/tasks/${t.id}`) },
          ]}
        />
      </div>
    </div>
  );
}
