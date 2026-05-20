import styles from './CalendarWeekView.module.css';
import pageStyles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';
import { EventPill } from './EventPill';
import { ResourceSidebar } from './ResourceSidebar';

interface CalendarWeekViewProps {
  weekStart: Date;     // Monday of the week
  resources: CalendarResource[];
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
  onSlotClick: (date: Date, resourceId: string) => void;
  isLoading: boolean;
}

const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarWeekView({
  weekStart,
  resources,
  events,
  onEventClick,
  onSlotClick,
  isLoading,
}: CalendarWeekViewProps) {
  // Build 7 days
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = toIsoDate(new Date());

  // Group events by (resourceId, dateStr)
  const evMap: Record<string, Record<string, CalendarEvent[]>> = {};
  for (const ev of events) {
    const dateStr = toIsoDate(ev.start);
    if (!evMap[ev.resourceId]) evMap[ev.resourceId] = {};
    if (!evMap[ev.resourceId][dateStr]) evMap[ev.resourceId][dateStr] = [];
    evMap[ev.resourceId][dateStr].push(ev);
  }

  // All visible resource rows including "unassigned"
  const allResources: Array<CalendarResource | { id: 'unassigned'; name: string; initials: string; role: string }> = [
    ...resources,
    { id: 'unassigned', name: 'Sin asignar', initials: '?', role: '' },
  ];

  if (isLoading) {
    return (
      <div className={styles.weekWrapper} role="region" aria-label="Calendario semanal">
        <ResourceSidebar resources={[]} isLoading headerHeight={32} />
        <div className={styles.gridArea}>
          <div className={styles.dayHeaderRow}>
            {days.map((d, i) => (
              <div key={i} className={styles.dayHeaderCell}>
                {DAY_NAMES_SHORT[i]} {d.getDate()}/{d.getMonth() + 1}
              </div>
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, ri) => (
            <div key={ri} className={styles.resourceGrid}>
              {Array.from({ length: 7 }).map((__, ci) => (
                <div key={ci} className={`${styles.slot} ${pageStyles.skeleton}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.weekWrapper} role="region" aria-label="Calendario semanal">
      <ResourceSidebar resources={resources} headerHeight={32} />
      <div className={styles.gridArea}>
        {/* Day header row */}
        <div className={styles.dayHeaderRow}>
          {days.map((d, i) => {
            const dStr = toIsoDate(d);
            const isToday = dStr === todayStr;
            return (
              <div key={i} className={`${styles.dayHeaderCell} ${isToday ? styles.dayHeaderToday : ''}`}>
                {DAY_NAMES_SHORT[i]} {d.getDate()}/{d.getMonth() + 1}
              </div>
            );
          })}
        </div>

        {/* Resource rows */}
        {allResources.map(resource => (
          <div key={resource.id} className={styles.resourceGrid}>
            {days.map((d, di) => {
              const dateStr = toIsoDate(d);
              const dayEvents = evMap[resource.id]?.[dateStr] ?? [];
              return (
                <div
                  key={di}
                  className={styles.slot}
                  onClick={() => onSlotClick(d, resource.id)}
                  aria-label={`Slot ${resource.name} ${dateStr}`}
                >
                  {dayEvents.map(ev => (
                    <EventPill
                      key={ev.id}
                      event={ev}
                      onClick={onEventClick}
                      variant="week"
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
