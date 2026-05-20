import styles from '../SchedulingCalendarPage.module.css';
import type { CalendarEvent } from '@/types/calendar';

interface EventPillProps {
  event: CalendarEvent;
  onClick: (id: string) => void;
  variant?: 'month' | 'week' | 'day';
}

const CATEGORY_CLASS: Record<CalendarEvent['stageCategory'], string> = {
  nuevo: styles.catNuevo,
  enProgreso: styles.catEnProgreso,
  hecho: styles.catHecho,
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function EventPill({ event, onClick, variant = 'day' }: EventPillProps) {
  const catClass = CATEGORY_CLASS[event.stageCategory] ?? styles.catNuevo;
  const ariaLabel = `Tarea: ${event.title}, ${formatTime(event.start)}`;
  const tooltip = `${event.title}${event.customerName ? ' — ' + event.customerName : ''}\n${formatTime(event.start)} – ${formatTime(event.end)}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(event.id);
    }
  }

  return (
    <div
      className={`${styles.eventPill} ${catClass} ${variant === 'month' ? styles.eventPillMonth : ''}`}
      onClick={() => onClick(event.id)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      title={tooltip}
      data-testid="event-pill"
      data-task-id={event.id}
    >
      {event.title}
      {variant !== 'month' && event.address && (
        <span className={styles.eventPillAddress}>{event.address}</span>
      )}
    </div>
  );
}
