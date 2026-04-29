import { useMemo } from 'react';
import { useTasks } from '@/hooks/useScheduling';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { ScheduledTask } from '@/types/scheduling';
import styles from './SchedulingProjectsPage.module.css';

const COLUMNS = [
  { label: 'Categoría', key: 'category' as const },
  { label: 'Título', key: 'title' as const },
  { label: 'Estado', key: 'status' as const },
  { label: 'Prioridad', key: 'priority' as const },
  { label: 'Asignado a', key: 'assignedTo' as const },
  { label: 'Fecha', key: 'scheduledDate' as const },
];

export default function SchedulingProjectsPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const activeTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled'),
    [tasks]
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Proyectos</h1>
      <div className={styles.kpiGrid} aria-label="KPI cards">
        <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{tasks.length}</p>
          <p className={styles.kpiLabel}>Total tareas</p>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#f59e0b' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{activeTasks.length}</p>
          <p className={styles.kpiLabel}>Tareas activas</p>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{tasks.filter(t => t.status === 'completed').length}</p>
          <p className={styles.kpiLabel}>Completadas</p>
        </div>
      </div>
      <DataTable<ScheduledTask>
        columns={COLUMNS}
        data={activeTasks}
        loading={isLoading}
        emptyMessage="No hay proyectos activos."
      />
    </div>
  );
}
