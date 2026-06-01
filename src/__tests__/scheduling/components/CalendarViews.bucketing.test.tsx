/**
 * TDD — RED phase: verify that calendar views bucket tasks by LOCAL date, not UTC date.
 *
 * Scenario: user is in UTC-3 (Argentina). "Today" is 2026-06-01 locally.
 * A task starts at 22:30 local (2026-06-01T22:30:00-03:00) = 2026-06-02T01:30:00Z.
 * UTC date of the event start = "2026-06-02" (wrong bucket).
 * Local date of the event start = "2026-06-01" (correct bucket).
 *
 * All three views MUST show the task in today's cell/column.
 *
 * Bug: all three components use `toIsoDate = d => d.toISOString().slice(0,10)` which
 * returns the UTC date string, so the task falls into the next-day bucket and disappears
 * from today's view.
 *
 * Fix: replace with `toLocalIsoDate` that uses getFullYear/getMonth/getDate (local TZ).
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';

import { CalendarWeekView } from '@/pages/scheduling/SchedulingCalendarPage/components/CalendarWeekView';
import { CalendarDayView } from '@/pages/scheduling/SchedulingCalendarPage/components/CalendarDayView';
import { CalendarMonthView } from '@/pages/scheduling/SchedulingCalendarPage/components/CalendarMonthView';

// ── Time control ──────────────────────────────────────────────────────────────
// Pin "now" to 2026-06-01T12:00:00-03:00 = 2026-06-01T15:00:00Z.
// This makes local today = "2026-06-01" and UTC today = "2026-06-01" (no ambiguity for "now").
// The TASK, however, starts at local 22:30 = UTC next-day 01:30.
const FIXED_NOW_UTC = new Date('2026-06-01T15:00:00.000Z'); // 12:00 ART

// The "problematic" task: starts at 22:30 local ART = 01:30 UTC next day.
// We construct the Date directly using local-tz constructor semantics via UTC offset.
// UTC-3: 22:30 local = 22:30+03:00 UTC = 2026-06-02T01:30:00Z
const EVENING_TASK_START = new Date('2026-06-02T01:30:00.000Z'); // = 2026-06-01T22:30:00 ART

// Verify our fixture: local date of the task must be the 1st, UTC date must be the 2nd.
// (These assertions guard against misconfigured TZ in CI where getDate() might be UTC.)
// We skip the TZ-dependent assertions at module level — they run as part of the test.

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TASK_TITLE = 'Tarea nocturna ARG';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev-night',
    title: TASK_TITLE,
    start: EVENING_TASK_START,
    end: new Date('2026-06-02T02:30:00.000Z'), // 23:30 ART
    resourceId: 'unassigned',
    stageCategory: 'nuevo',
    ...overrides,
  };
}

const NO_RESOURCES: CalendarResource[] = [];

// Monday of the week containing 2026-06-01 (which IS a Monday)
const WEEK_START = new Date('2026-06-01T03:00:00.000Z'); // 00:00 ART on Mon Jun 1

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW_UTC);
});

afterAll(() => {
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CalendarWeekView — day bucketing uses LOCAL date (REQ-TZ-BUCKET)', () => {
  it('task at 22:30 ART (= UTC+1 next day) appears in TODAY\'s slot (Jun 1), not Jun 2', () => {
    const event = makeEvent();

    // Pre-condition: confirm UTC date is next day (the bug condition)
    expect(event.start.toISOString().slice(0, 10)).toBe('2026-06-02'); // UTC = June 2 ← the bug

    render(
      React.createElement(CalendarWeekView, {
        weekStart: WEEK_START,
        resources: NO_RESOURCES,
        events: [event],
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    // The slot for "Sin asignar" on Jun 1 must contain the task.
    // aria-label = "Slot Sin asignar 2026-06-01"
    const jun1SlotEl = document.querySelector('[aria-label="Slot Sin asignar 2026-06-01"]');
    expect(jun1SlotEl).not.toBeNull();
    expect(jun1SlotEl).toHaveTextContent(TASK_TITLE);

    // The Jun 2 slot must be empty
    const jun2SlotEl = document.querySelector('[aria-label="Slot Sin asignar 2026-06-02"]');
    expect(jun2SlotEl).not.toBeNull();
    expect(jun2SlotEl).not.toHaveTextContent(TASK_TITLE);
  });
});

describe('CalendarDayView — day filter uses LOCAL date (REQ-TZ-BUCKET)', () => {
  it('task at 22:30 ART (= UTC+1 next day) is visible in day view for Jun 1', () => {
    const event = makeEvent();

    // date = today (Jun 1 local)
    const todayLocal = new Date('2026-06-01T03:00:00.000Z'); // midnight ART

    render(
      React.createElement(CalendarDayView, {
        date: todayLocal,
        resources: NO_RESOURCES,
        events: [event],
        fullDay: true,  // show all hours so 22:30 is visible
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    expect(screen.getByText(TASK_TITLE)).toBeInTheDocument();
  });

  it('task at 22:30 ART does NOT appear in day view for Jun 2', () => {
    const event = makeEvent();

    // date = tomorrow local (Jun 2)
    const tomorrowLocal = new Date('2026-06-02T03:00:00.000Z'); // midnight ART Jun 2

    render(
      React.createElement(CalendarDayView, {
        date: tomorrowLocal,
        resources: NO_RESOURCES,
        events: [event],
        fullDay: true,
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    // The task should NOT appear in Jun 2's day view (it belongs to Jun 1 locally)
    expect(screen.queryByText(TASK_TITLE)).not.toBeInTheDocument();
  });
});

describe('CalendarMonthView — event bucket uses LOCAL date (REQ-TZ-BUCKET)', () => {
  it('task at 22:30 ART (= UTC+1 next day) appears in Jun 1 cell, not Jun 2', () => {
    const event = makeEvent();

    render(
      React.createElement(CalendarMonthView, {
        year: 2026,
        month: 5,  // June (0-indexed)
        events: [event],
        onEventClick: () => {},
        onDayClick: () => {},
        onMoreClick: () => {},
        isLoading: false,
      })
    );

    // Cell for Jun 1 has aria-label="1 de Junio"
    const jun1Cell = document.querySelector('[aria-label="1 de Junio"]');
    expect(jun1Cell).not.toBeNull();
    expect(jun1Cell).toHaveTextContent(TASK_TITLE);

    // Cell for Jun 2 must NOT contain the task
    const jun2Cell = document.querySelector('[aria-label="2 de Junio"]');
    expect(jun2Cell).not.toBeNull();
    expect(jun2Cell).not.toHaveTextContent(TASK_TITLE);
  });
});
