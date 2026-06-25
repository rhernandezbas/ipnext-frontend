import styles from './CalendarDayView.module.css';
import pageStyles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';
import { EventPill } from './EventPill';
import { avatarColor } from './resourceAvatar';
import { toArIsoDate, arHour, wallDayIso } from '@/utils/formatDate';

interface CalendarDayViewProps {
  date: Date;
  resources: CalendarResource[];
  events: CalendarEvent[];
  fullDay: boolean;
  onEventClick: (id: string) => void;
  onSlotClick: (date: Date, hour: number, resourceId: string) => void;
  isLoading: boolean;
}

type RowResource = CalendarResource | { id: 'unassigned'; name: string; initials: string; role: string };

function buildHours(fullDay: boolean): number[] {
  return fullDay
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 13 }, (_, i) => i + 8); // 08–20
}

/**
 * Resource label cell — the first column of a resource's grid row.
 * Shares the row with that resource's hour cells, so it can never drift out of
 * alignment when a cell grows with stacked events.
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

export function CalendarDayView({
  date,
  resources,
  events,
  fullDay,
  onEventClick,
  onSlotClick,
  isLoading,
}: CalendarDayViewProps) {
  const hours = buildHours(fullDay);
  const nHours = hours.length;
  // `date` is the selected day as a host-local-anchored marker → wall-day key.
  const dateStr = wallDayIso(date);

  // label column + N hour columns
  const gridTemplateColumns = `240px repeat(${nHours}, minmax(60px, 1fr))`;

  // Group events by resourceId for this day
  const evByResource: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (toArIsoDate(ev.start) !== dateStr) continue;
    if (!evByResource[ev.resourceId]) evByResource[ev.resourceId] = [];
    evByResource[ev.resourceId].push(ev);
  }

  // All rows including "unassigned"
  const allResources: RowResource[] = [
    ...resources,
    { id: 'unassigned', name: 'Sin asignar', initials: '?', role: '' },
  ];

  const header = (
    <>
      <div className={styles.cornerCell} />
      {hours.map(h => (
        <div key={h} className={styles.hourHeader} data-hour={h}>
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </>
  );

  if (isLoading) {
    return (
      <div className={styles.dayWrapper} role="region" aria-label="Calendario diario">
        <div className={styles.calendarGrid} style={{ gridTemplateColumns }}>
          {header}
          {Array.from({ length: 4 }).map((_, ri) => (
            <div key={ri} className={styles.resourceRow} data-resource-row={`skeleton-${ri}`}>
              <div className={`${styles.labelCell} ${pageStyles.skeleton}`} data-testid="resource-row" />
              {hours.map(h => (
                <div key={h} className={`${styles.hourSlot} ${pageStyles.skeleton}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dayWrapper} role="region" aria-label="Calendario diario">
      <div className={styles.calendarGrid} style={{ gridTemplateColumns }}>
        {header}

        {/* One grid row per resource: [label | hour-1 … hour-N]. The wrapper uses
            display:contents so the label and hour cells are siblings on the SAME
            grid row, sharing height regardless of event stacking. */}
        {allResources.map(resource => {
          const resourceEvents = evByResource[resource.id] ?? [];
          return (
            <div
              key={resource.id}
              className={styles.resourceRow}
              data-resource-row={resource.id}
              data-resource-id={resource.id}
            >
              <ResourceLabelCell resource={resource} />
              {hours.map(h => {
                // Find events starting in this hour (Argentina wall-clock hour)
                const hourEvents = resourceEvents.filter(ev => arHour(ev.start) === h);
                return (
                  <div
                    key={h}
                    className={styles.hourSlot}
                    onClick={() => onSlotClick(date, h, resource.id)}
                    aria-label={`${String(h).padStart(2, '0')}:00 - ${resource.name}`}
                  >
                    {hourEvents.map(ev => (
                      <EventPill
                        key={ev.id}
                        event={ev}
                        onClick={onEventClick}
                        variant="day"
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
