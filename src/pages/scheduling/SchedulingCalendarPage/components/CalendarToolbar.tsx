import styles from './CalendarToolbar.module.css';
import type { CalendarView } from '@/types/calendar';
import type { TaskListFilter } from '@/types/scheduling';
import type { Project } from '@/types/project';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  filter: TaskListFilter;
  onFilterChange: (patch: Partial<TaskListFilter>) => void;
  projects: Project[];
  fullDay: boolean;
  onToggleFullDay: () => void;
  showFullDayToggle: boolean;
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

export function CalendarToolbar({
  view,
  onViewChange,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  filter,
  onFilterChange,
  projects,
  fullDay,
  onToggleFullDay,
  showFullDayToggle,
}: CalendarToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Controles del calendario">
      {/* Project filter */}
      <select
        className={styles.select}
        value={filter.projectId ?? ''}
        onChange={e => onFilterChange({ projectId: e.target.value || undefined })}
        aria-label="Filtrar por proyecto"
      >
        <option value="">Todos los proyectos</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>

      <div className={styles.divider} />

      {/* Navigation */}
      <div className={styles.navGroup}>
        <button
          className={styles.btnIcon}
          onClick={onPrev}
          aria-label="Período anterior"
          title="Período anterior"
        >
          ‹
        </button>
        <span className={styles.periodLabel}>{periodLabel}</span>
        <button
          className={styles.btnIcon}
          onClick={onNext}
          aria-label="Período siguiente"
          title="Período siguiente"
        >
          ›
        </button>
        <button
          className={styles.btnSecondary}
          onClick={onToday}
          aria-label="Hoy"
        >
          Hoy
        </button>
      </div>

      <div className={styles.divider} />

      {/* View selector */}
      <div className={styles.viewGroup}>
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            className={view === key ? styles.btnSecondaryActive : styles.btnSecondary}
            onClick={() => onViewChange(key)}
            aria-pressed={view === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Full day toggle — day view only */}
      {showFullDayToggle && (
        <>
          <div className={styles.divider} />
          <button
            className={fullDay ? styles.btnSecondaryActive : styles.btnSecondary}
            onClick={onToggleFullDay}
            aria-pressed={fullDay}
          >
            Día completo
          </button>
        </>
      )}
    </div>
  );
}
