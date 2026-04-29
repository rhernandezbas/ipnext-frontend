import { useMemo } from 'react';
import { useTasks } from '@/hooks/useScheduling';
import styles from './SchedulingCalendarPage.module.css';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function SchedulingCalendarPage() {
  const { data: tasks = [] } = useTasks();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDay = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      const d = t.scheduledDate?.slice(0, 10);
      if (d) map[d] = (map[d] ?? 0) + 1;
    });
    return map;
  }, [tasks]);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Calendario — {MONTHS[month]} {year}</h1>
      <div className={styles.calendarGrid}>
        {DAYS.map(d => <div key={d} className={styles.dayHeader}>{d}</div>)}
        {cells.map((day, i) => {
          const dateKey = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const count = day ? (tasksByDay[dateKey] ?? 0) : 0;
          const isToday = day === now.getDate();
          return (
            <div key={i} className={`${styles.cell} ${day ? styles.active : ''} ${isToday ? styles.today : ''}`}>
              {day && <span className={styles.dayNum}>{day}</span>}
              {count > 0 && <span className={styles.taskCount}>{count} tarea{count !== 1 ? 's' : ''}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
