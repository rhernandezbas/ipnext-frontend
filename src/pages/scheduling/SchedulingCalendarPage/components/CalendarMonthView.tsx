import styles from './CalendarMonthView.module.css';
import pageStyles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent } from '@/types/calendar';
import { EventPill } from './EventPill';

interface CalendarMonthViewProps {
  year: number;
  month: number;  // 0-indexed
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
  onDayClick: (date: Date) => void;
  onMoreClick: (date: Date) => void;
  isLoading: boolean;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarMonthView({
  year,
  month,
  events,
  onEventClick,
  onDayClick,
  onMoreClick,
  isLoading,
}: CalendarMonthViewProps) {
  const today = new Date();
  const todayStr = toIsoDate(today);

  // Group events by date string
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const key = toIsoDate(ev.start);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  }

  // Compute cells: Mon-first
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
  // For Mon-first: Mon=0, Tue=1, ..., Sun=6
  const firstDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // Leading blank cells
  const leadingBlanks = firstDayOfWeek;

  if (isLoading) {
    return (
      <div className={styles.monthGrid} aria-label="Calendario mensual" role="region">
        {DAY_NAMES.map(d => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className={`${styles.cell} ${pageStyles.skeleton}`} style={{ minHeight: 100 }} />
        ))}
      </div>
    );
  }

  const isEmpty = events.length === 0;

  if (isEmpty) {
    return (
      <div>
        <div className={styles.monthGrid}>
          {DAY_NAMES.map(d => (
            <div key={d} className={styles.dayHeader}>{d}</div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const date = new Date(year, month, day);
            return (
              <div
                key={day}
                className={`${styles.cell} ${isToday ? styles.cellToday : ''}`}
                onClick={() => onDayClick(date)}
                aria-label={`${day} de ${MONTH_NAMES[month]}`}
              >
                <span className={styles.dayNum}>{day}</span>
              </div>
            );
          })}
        </div>
        <div className={pageStyles.emptyState}>
          <svg className={pageStyles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Sin tareas en este rango.</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Cargá una nueva o ajustá los filtros.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.monthGrid} aria-label="Calendario mensual" role="region">
      {DAY_NAMES.map(d => (
        <div key={d} className={styles.dayHeader}>{d}</div>
      ))}
      {Array.from({ length: leadingBlanks }).map((_, i) => (
        <div key={`blank-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
      ))}
      {Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayEvents = eventsByDate[dateStr] ?? [];
        const visibleEvents = dayEvents.slice(0, 3);
        const overflow = dayEvents.length - 3;
        const date = new Date(year, month, day);

        return (
          <div
            key={day}
            className={`${styles.cell} ${isToday ? styles.cellToday : ''}`}
            onClick={() => onDayClick(date)}
            aria-label={`${day} de ${MONTH_NAMES[month]}`}
          >
            <span className={styles.dayNum}>{day}</span>
            {visibleEvents.map(ev => (
              <EventPill
                key={ev.id}
                event={ev}
                onClick={onEventClick}
                variant="month"
              />
            ))}
            {overflow > 0 && (
              <button
                className={styles.moreLink}
                onClick={e => {
                  e.stopPropagation();
                  onMoreClick(date);
                }}
                aria-label={`Ver ${overflow} tareas más del ${day} de ${MONTH_NAMES[month]}`}
              >
                +{overflow} más
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
