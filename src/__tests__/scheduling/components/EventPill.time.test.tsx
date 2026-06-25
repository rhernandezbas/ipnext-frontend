/**
 * Fase 2a — EventPill renders the event time in Argentina time, deterministically,
 * regardless of the host timezone.
 *
 * Bug: formatTime() used toLocaleTimeString('es-AR', …) WITHOUT a timeZone, so the
 * pill's aria-label / tooltip showed the host-local hour. In a UTC environment a
 * 22:30 ART task (stored as 01:30 UTC the next day) showed "01:30" instead of "22:30".
 *
 * These assertions use UTC ISO inputs with the expected AR output, so they pass
 * under TZ=UTC and TZ=America/Argentina/Buenos_Aires identically.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import type { CalendarEvent } from '@/types/calendar';
import { EventPill } from '@/pages/scheduling/SchedulingCalendarPage/components/EventPill';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev-1',
    title: 'Tarea nocturna ARG',
    // 22:30 ART = 01:30 UTC next day; 23:30 ART = 02:30 UTC next day.
    start: new Date('2026-06-02T01:30:00.000Z'),
    end: new Date('2026-06-02T02:30:00.000Z'),
    resourceId: 'unassigned',
    stageCategory: 'nuevo',
    ...overrides,
  };
}

describe('EventPill — time shown in Argentina time (REQ-TZ-DISPLAY)', () => {
  it('aria-label uses the AR start time (22:30), not the host-local/UTC hour', () => {
    render(React.createElement(EventPill, { event: makeEvent(), onClick: () => {} }));
    const pill = screen.getByTestId('event-pill');
    expect(pill.getAttribute('aria-label')).toBe('Tarea: Tarea nocturna ARG, 22:30');
  });

  it('tooltip shows the AR start–end range (22:30 – 23:30)', () => {
    render(React.createElement(EventPill, { event: makeEvent(), onClick: () => {} }));
    const pill = screen.getByTestId('event-pill');
    expect(pill.getAttribute('title')).toContain('22:30 – 23:30');
  });

  it('a mid-day UTC instant renders its AR hour (16:45Z → 13:45)', () => {
    const event = makeEvent({
      start: new Date('2025-09-08T16:45:00.000Z'),
      end: new Date('2025-09-08T17:45:00.000Z'),
    });
    render(React.createElement(EventPill, { event, onClick: () => {} }));
    const pill = screen.getByTestId('event-pill');
    expect(pill.getAttribute('aria-label')).toBe('Tarea: Tarea nocturna ARG, 13:45');
    expect(pill.getAttribute('title')).toContain('13:45 – 14:45');
  });
});
