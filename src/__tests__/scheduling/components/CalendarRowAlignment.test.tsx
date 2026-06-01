/**
 * TDD — RED phase: per-resource row integrity (REQ-ROW-ALIGN).
 *
 * Confirmed bug (Playwright, prod): the resource sidebar used FIXED-height rows
 * while the day-grid cells GROW with stacked events. A técnico with many tasks
 * makes his grid cell tall, so every subsequent técnico's sidebar label no longer
 * lines up with its grid row → tasks appear beside the WRONG técnico.
 *
 * Root cause: ResourceSidebar (labels) and the day grid (cells) were rendered as
 * TWO independent subtrees side-by-side, relying on every row being equal fixed
 * height. Variable event stacking per cell breaks that assumption.
 *
 * Fix: a SINGLE CSS grid where each resource contributes ONE row spanning
 * [label cell | day-1 cell | … | day-N cell]. The label and all day cells of a
 * resource SHARE the same row container, so they share the same row height
 * automatically regardless of how many events stack.
 *
 * Structural contract (what we can assert in jsdom — pixel alignment is not
 * measurable here): for EACH resource, the label cell AND that resource's event
 * pills must live inside the SAME per-resource row container, NOT in sibling
 * subtrees. A resource's events must never render inside a different resource's row.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import type { CalendarEvent, CalendarResource } from '@/types/calendar';

import { CalendarWeekView } from '@/pages/scheduling/SchedulingCalendarPage/components/CalendarWeekView';
import { CalendarDayView } from '@/pages/scheduling/SchedulingCalendarPage/components/CalendarDayView';

// Monday Jun 1 2026 (the date the views were exercised against in prod)
const WEEK_START = new Date(2026, 5, 1); // local midnight Mon Jun 1
const DAY_DATE = new Date(2026, 5, 1);

const RESOURCES: CalendarResource[] = [
  { id: 'r-rodrigo', name: 'Rodrigo López', initials: 'RL', role: 'technician' },
  { id: 'r-ana', name: 'Ana García', initials: 'AG', role: 'technician' },
];

function ev(id: string, resourceId: string, hour: number): CalendarEvent {
  const start = new Date(2026, 5, 1, hour, 0, 0);
  const end = new Date(2026, 5, 1, hour + 1, 0, 0);
  return {
    id,
    title: `Tarea ${id}`,
    start,
    end,
    resourceId,
    stageCategory: 'nuevo',
  };
}

// Rodrigo has 4 stacked tasks on Monday → his cell grows tall.
// Ana has 1 task. The bug would make Ana's label slide up beside Rodrigo's
// tall cell. We assert structural row ownership instead of pixels.
const RODRIGO_EVENTS = [
  ev('rod-1', 'r-rodrigo', 9),
  ev('rod-2', 'r-rodrigo', 10),
  ev('rod-3', 'r-rodrigo', 11),
  ev('rod-4', 'r-rodrigo', 12),
];
const ANA_EVENT = ev('ana-1', 'r-ana', 9);
const ALL_EVENTS = [...RODRIGO_EVENTS, ANA_EVENT];

/**
 * Returns the per-resource row container for a given resourceId.
 * The new structure marks each resource's row with data-resource-row="<id>".
 */
function rowFor(container: HTMLElement, resourceId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-resource-row="${resourceId}"]`);
}

describe('CalendarWeekView — per-resource row integrity (REQ-ROW-ALIGN)', () => {
  it('each resource row contains BOTH its label and its own events (single grid)', () => {
    const { container } = render(
      React.createElement(CalendarWeekView, {
        weekStart: WEEK_START,
        resources: RESOURCES,
        events: ALL_EVENTS,
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    const rodrigoRow = rowFor(container, 'r-rodrigo');
    const anaRow = rowFor(container, 'r-ana');

    expect(rodrigoRow).not.toBeNull();
    expect(anaRow).not.toBeNull();

    // Label lives inside the same row as the events.
    expect(rodrigoRow).toHaveTextContent('Rodrigo López');
    expect(anaRow).toHaveTextContent('Ana García');

    // Each resource's events live inside ITS OWN row, not a sibling's.
    for (const e of RODRIGO_EVENTS) {
      expect(rodrigoRow!.querySelector(`[data-task-id="${e.id}"]`)).not.toBeNull();
      expect(anaRow!.querySelector(`[data-task-id="${e.id}"]`)).toBeNull();
    }
    expect(anaRow!.querySelector('[data-task-id="ana-1"]')).not.toBeNull();
    expect(rodrigoRow!.querySelector('[data-task-id="ana-1"]')).toBeNull();
  });

  it('renders one row per resource plus the "Sin asignar" row', () => {
    const { container } = render(
      React.createElement(CalendarWeekView, {
        weekStart: WEEK_START,
        resources: RESOURCES,
        events: ALL_EVENTS,
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    const rows = container.querySelectorAll('[data-resource-row]');
    // 2 technicians + Sin asignar
    expect(rows).toHaveLength(RESOURCES.length + 1);
    expect(rowFor(container, 'unassigned')).not.toBeNull();
  });
});

describe('CalendarDayView — per-resource row integrity (REQ-ROW-ALIGN)', () => {
  it('each resource row contains BOTH its label and its own events (single grid)', () => {
    const { container } = render(
      React.createElement(CalendarDayView, {
        date: DAY_DATE,
        resources: RESOURCES,
        events: ALL_EVENTS,
        fullDay: true,
        onEventClick: () => {},
        onSlotClick: () => {},
        isLoading: false,
      })
    );

    const rodrigoRow = rowFor(container, 'r-rodrigo');
    const anaRow = rowFor(container, 'r-ana');

    expect(rodrigoRow).not.toBeNull();
    expect(anaRow).not.toBeNull();

    expect(rodrigoRow).toHaveTextContent('Rodrigo López');
    expect(anaRow).toHaveTextContent('Ana García');

    for (const e of RODRIGO_EVENTS) {
      expect(rodrigoRow!.querySelector(`[data-task-id="${e.id}"]`)).not.toBeNull();
      expect(anaRow!.querySelector(`[data-task-id="${e.id}"]`)).toBeNull();
    }
    expect(anaRow!.querySelector('[data-task-id="ana-1"]')).not.toBeNull();
    expect(rodrigoRow!.querySelector('[data-task-id="ana-1"]')).toBeNull();
  });
});
