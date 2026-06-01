import styles from './CalendarWeekView.module.css';
import pageStyles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';
import { EventPill } from './EventPill';
import { avatarColor } from './resourceAvatar';

interface CalendarWeekViewProps {
  weekStart: Date;     // Monday of the week
  resources: CalendarResource[];
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
  onSlotClick: (date: Date, resourceId: string) => void;
  isLoading: boolean;
}

type RowResource = CalendarResource | { id: 'unassigned'; name: string; initials: string; role: string };

const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resource label cell — the first column of a resource's grid row.
 * It shares the row with that resource's day cells, so it can never drift out
 * of alignment when a cell grows with stacked events.
 */
function ResourceLabelCell({ resource }: { resource: RowResource }) {
  const isUnassigned = resource.id === 'unassigned';
  return (
    <div
      className={styles.labelCell}
      data-testid="resource-row"
      data-resource-id={resource.id}
    >
      <div
        className={pageStyles.avatar}
        style={{ backgroundColor: isUnassigned ? 'var(--color-gray-300)' : avatarColor(resource.name) }}
        aria-hidden="true"
      >
        {resource.initials}
      </div>
      <span className={styles.resourceName}>{resource.name}</span>
    </div>
  );
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
  const todayStr = toLocalIsoDate(new Date());

  // Group events by (resourceId, dateStr)
  const evMap: Record<string, Record<string, CalendarEvent[]>> = {};
  for (const ev of events) {
    const dateStr = toLocalIsoDate(ev.start);
    if (!evMap[ev.resourceId]) evMap[ev.resourceId] = {};
    if (!evMap[ev.resourceId][dateStr]) evMap[ev.resourceId][dateStr] = [];
    evMap[ev.resourceId][dateStr].push(ev);
  }

  // All visible resource rows including "unassigned"
  const allResources: RowResource[] = [
    ...resources,
    { id: 'unassigned', name: 'Sin asignar', initials: '?', role: '' },
  ];

  const header = (
    <>
      <div className={styles.cornerCell} />
      {days.map((d, i) => {
        const dStr = toLocalIsoDate(d);
        const isToday = dStr === todayStr;
        return (
          <div key={i} className={`${styles.dayHeaderCell} ${isToday ? styles.dayHeaderToday : ''}`}>
            {DAY_NAMES_SHORT[i]} {d.getDate()}/{d.getMonth() + 1}
          </div>
        );
      })}
    </>
  );

  if (isLoading) {
    return (
      <div className={styles.weekWrapper} role="region" aria-label="Calendario semanal">
        <div className={styles.calendarGrid}>
          {header}
          {Array.from({ length: 4 }).map((_, ri) => (
            <div key={ri} className={styles.resourceRow} data-resource-row={`skeleton-${ri}`}>
              <div className={`${styles.labelCell} ${pageStyles.skeleton}`} data-testid="resource-row" />
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
      <div className={styles.calendarGrid}>
        {header}

        {/* One grid row per resource: [label | day-1 … day-7]. The wrapper uses
            display:contents so the label and day cells are siblings on the SAME
            grid row, sharing height regardless of event stacking. */}
        {allResources.map(resource => (
          <div
            key={resource.id}
            className={styles.resourceRow}
            data-resource-row={resource.id}
          >
            <ResourceLabelCell resource={resource} />
            {days.map((d, di) => {
              const dateStr = toLocalIsoDate(d);
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
