/**
 * Tests for useCalendarUrlState hook.
 * Uses renderHook with MemoryRouter + initial URL entries.
 * Change: scheduling-calendar-view, Phase 3.3
 */
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useCalendarUrlState } from '@/pages/scheduling/SchedulingCalendarPage/hooks/useCalendarUrlState';

function wrapper(initialSearch = '') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [`/test${initialSearch}`] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: '/test', element: children as React.ReactElement })
      )
    );
  };
}

describe('useCalendarUrlState', () => {
  it('returns default view = week when no param', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper(),
    });
    expect(result.current.view).toBe('week');
  });

  it('reads view from URL param', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day'),
    });
    expect(result.current.view).toBe('day');
  });

  it('reads date from URL param', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?date=2026-05-20'),
    });
    expect(result.current.date.getDate()).toBe(20);
    expect(result.current.date.getMonth()).toBe(4); // May = index 4
    expect(result.current.date.getFullYear()).toBe(2026);
  });

  it('defaults date to today (AR day) when param absent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z')); // 09:00 ART; dia AR == UTC == 15
    try {
      const { result } = renderHook(() => useCalendarUrlState(), {
        wrapper: wrapper(),
      });
      expect(result.current.date.getFullYear()).toBe(2026);
      expect(result.current.date.getMonth()).toBe(5); // junio
      expect(result.current.date.getDate()).toBe(15);
    } finally {
      vi.useRealTimers();
    }
  });

  it('setView updates the URL view param', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week'),
    });
    act(() => {
      result.current.setView('month');
    });
    expect(result.current.view).toBe('month');
  });

  it('goNext in week view advances date by 7 days', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    act(() => {
      result.current.goNext();
    });
    // 2026-05-20 + 7 = 2026-05-27
    expect(result.current.date.getDate()).toBe(27);
    expect(result.current.date.getMonth()).toBe(4);
    expect(result.current.date.getFullYear()).toBe(2026);
  });

  it('goPrev in week view retreats date by 7 days', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-27'),
    });
    act(() => {
      result.current.goPrev();
    });
    expect(result.current.date.getDate()).toBe(20);
    expect(result.current.date.getMonth()).toBe(4);
  });

  it('goNext in day view advances by 1 day', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-05-20'),
    });
    act(() => {
      result.current.goNext();
    });
    expect(result.current.date.getDate()).toBe(21);
  });

  it('goNext in month view advances by 1 month', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    act(() => {
      result.current.goNext();
    });
    expect(result.current.date.getMonth()).toBe(5); // June = index 5
  });

  it('goToday resets date to today (AR day)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z')); // 09:00 ART; dia AR == UTC == 15
    try {
      const { result } = renderHook(() => useCalendarUrlState(), {
        wrapper: wrapper('?view=week&date=2026-01-01'),
      });
      act(() => {
        result.current.goToday();
      });
      expect(result.current.date.getMonth()).toBe(5); // junio
      expect(result.current.date.getDate()).toBe(15);
    } finally {
      vi.useRealTimers();
    }
  });

  it('default "today" resolves to the AR day, not the host-UTC day, at 23:30 ART (TZ-BUG-3)', () => {
    // 2026-06-25T02:30:00Z = 23:30 ART del 24-jun. En un host UTC, setHours(0,0,0,0)
    // daria el 25 (UTC) y correria el dia/rango. Debe resolver al dia AR (24-jun).
    // Bajo TZ=AR ya pasaba; bajo TZ=UTC fallaba (el bug). Determinista tras el fix.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T02:30:00Z'));
    try {
      const { result } = renderHook(() => useCalendarUrlState(), {
        wrapper: wrapper('?view=day'),
      });
      expect(result.current.from).toBe('2026-06-24T03:00:00.000Z'); // 00:00 ART 24-jun
      expect(result.current.to).toBe('2026-06-25T02:59:59.999Z');   // 23:59 ART 24-jun
    } finally {
      vi.useRealTimers();
    }
  });

  // Fase 2a — the API range is now AR-fixed and DETERMINISTIC across host TZ.
  // AR is a fixed UTC-3: 00:00 ART = 03:00 UTC same date; 23:59:59.999 ART =
  // 02:59:59.999 UTC the NEXT date. These exact-instant assertions pass identically
  // under TZ=UTC and TZ=America/Argentina/Buenos_Aires (previously they only held
  // under TZ=AR — the bug).

  it('computes from/to for week view (AR-fixed, deterministic)', () => {
    // 2026-05-20 is a Wednesday; week = Mon 2026-05-18 … Sun 2026-05-24.
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    expect(result.current.from).toBe('2026-05-18T03:00:00.000Z'); // 00:00 ART Mon
    expect(result.current.to).toBe('2026-05-25T02:59:59.999Z');   // 23:59 ART Sun
  });

  it('computes from/to for day view (AR-fixed, deterministic)', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-05-20'),
    });
    expect(result.current.from).toBe('2026-05-20T03:00:00.000Z'); // 00:00 ART
    expect(result.current.to).toBe('2026-05-21T02:59:59.999Z');   // 23:59 ART
  });

  it('computes from/to for month view (AR-fixed, deterministic)', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    expect(result.current.from).toBe('2026-05-01T03:00:00.000Z'); // 00:00 ART May 1
    expect(result.current.to).toBe('2026-06-01T02:59:59.999Z');   // 23:59 ART May 31
  });

  // ---------------------------------------------------------------------------
  // Timezone-aware range bounds (TZ-BUG-2 / Fase 2a)
  // The range must cover the FULL ARGENTINA day, not the UTC calendar day, AND it
  // must be deterministic regardless of the host TZ. For AR (fixed UTC-3): AR
  // midnight = 03:00 UTC same date; AR 23:59:59.999 = 02:59:59.999 UTC next date.
  // The expected boundaries below are FIXED UTC instants (no host-local Date math),
  // so these hold under TZ=UTC and TZ=AR alike. A 22:30 ART task (= 01:30 UTC next
  // day) must fall inside the day range.
  // ---------------------------------------------------------------------------

  it('day view from/to covers the full AR day and includes a 22:30 ART task', () => {
    const arMidnightUTC = '2026-06-01T03:00:00.000Z';      // 00:00 ART Jun 1
    const arEndOfDayUTC = '2026-06-02T02:59:59.999Z';      // 23:59 ART Jun 1
    const eveningTaskUTC = '2026-06-02T01:30:00.000Z';     // 22:30 ART Jun 1
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-06-01'),
    });
    expect(result.current.from <= arMidnightUTC).toBe(true);
    expect(result.current.to >= arEndOfDayUTC).toBe(true);
    // The late-evening task must be inside [from, to].
    expect(result.current.from <= eveningTaskUTC).toBe(true);
    expect(result.current.to >= eveningTaskUTC).toBe(true);
  });

  it('week view from/to covers the full AR week (deterministic)', () => {
    // 2026-05-20 is Wednesday; AR week: Mon 2026-05-18 … Sun 2026-05-24.
    const weekStartUTC = '2026-05-18T03:00:00.000Z'; // 00:00 ART Mon
    const weekEndUTC   = '2026-05-25T02:59:59.999Z'; // 23:59 ART Sun
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    expect(result.current.from <= weekStartUTC).toBe(true);
    expect(result.current.to >= weekEndUTC).toBe(true);
  });

  it('month view from/to covers the full AR month (deterministic)', () => {
    // May 2026: AR May 1 … AR May 31.
    const monthStartUTC = '2026-05-01T03:00:00.000Z'; // 00:00 ART May 1
    const monthEndUTC   = '2026-06-01T02:59:59.999Z'; // 23:59 ART May 31
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    expect(result.current.from <= monthStartUTC).toBe(true);
    expect(result.current.to >= monthEndUTC).toBe(true);
  });

  it('reads projectId filter from URL', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?projectId=proj-123'),
    });
    expect(result.current.filter.projectId).toBe('proj-123');
  });

  it('fullDay defaults to false', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper(),
    });
    expect(result.current.fullDay).toBe(false);
  });

  it('fullDay=1 in URL sets fullDay to true', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?fullDay=1'),
    });
    expect(result.current.fullDay).toBe(true);
  });

  it('toggleFullDay sets fullDay=1 in URL', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper(),
    });
    act(() => {
      result.current.toggleFullDay();
    });
    expect(result.current.fullDay).toBe(true);
  });
});
