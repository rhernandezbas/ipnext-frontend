import styles from './CalendarDayView.module.css';
import pageStyles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';
import { EventPill } from './EventPill';
import { ResourceSidebar } from './ResourceSidebar';

interface CalendarDayViewProps {
  date: Date;
  resources: CalendarResource[];
  events: CalendarEvent[];
  fullDay: boolean;
  onEventClick: (id: string) => void;
  onSlotClick: (date: Date, hour: number, resourceId: string) => void;
  isLoading: boolean;
}

const HOUR_HEADER_HEIGHT = 32; // px

function buildHours(fullDay: boolean): number[] {
  return fullDay
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 13 }, (_, i) => i + 8); // 08–20
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  const dateStr = toIsoDate(date);

  // Group events by resourceId for this day
  const evByResource: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (toIsoDate(ev.start) !== dateStr) continue;
    if (!evByResource[ev.resourceId]) evByResource[ev.resourceId] = [];
    evByResource[ev.resourceId].push(ev);
  }

  // All rows including "unassigned"
  const allResources: Array<CalendarResource | { id: 'unassigned'; name: string; initials: string; role: string }> = [
    ...resources,
    { id: 'unassigned', name: 'Sin asignar', initials: '?', role: '' },
  ];

  if (isLoading) {
    return (
      <div className={styles.dayWrapper} role="region" aria-label="Calendario diario">
        <ResourceSidebar resources={[]} isLoading headerHeight={HOUR_HEADER_HEIGHT} />
        <div className={styles.gridArea}>
          <div className={styles.hourHeaderRow} style={{ gridTemplateColumns: `repeat(${nHours}, minmax(60px, 1fr))` }}>
            {hours.map(h => (
              <div key={h} className={styles.hourHeader}>{String(h).padStart(2, '0')}:00</div>
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, ri) => (
            <div
              key={ri}
              className={`${styles.resourceRow} ${pageStyles.skeleton}`}
              style={{ gridTemplateColumns: `repeat(${nHours}, minmax(60px, 1fr))` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dayWrapper} role="region" aria-label="Calendario diario">
      <ResourceSidebar resources={resources} headerHeight={HOUR_HEADER_HEIGHT} />
      <div className={styles.gridArea}>
        {/* Hour header row — sticky top */}
        <div
          className={styles.hourHeaderRow}
          style={{ gridTemplateColumns: `repeat(${nHours}, minmax(60px, 1fr))` }}
        >
          {hours.map(h => (
            <div key={h} className={styles.hourHeader} data-hour={h}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Resource rows */}
        {allResources.map(resource => {
          const resourceEvents = evByResource[resource.id] ?? [];
          return (
            <div
              key={resource.id}
              className={styles.resourceRow}
              style={{ gridTemplateColumns: `repeat(${nHours}, minmax(60px, 1fr))` }}
              data-resource-id={resource.id}
            >
              {hours.map(h => {
                // Find events starting in this hour
                const hourEvents = resourceEvents.filter(ev => ev.start.getHours() === h);
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
