/**
 * Tests for useCalendarUrlState hook.
 * Uses renderHook with MemoryRouter + initial URL entries.
 * Change: scheduling-calendar-view, Phase 3.3
 */
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
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

  it('defaults date to today when param absent', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper(),
    });
    const today = new Date();
    expect(result.current.date.getDate()).toBe(today.getDate());
    expect(result.current.date.getMonth()).toBe(today.getMonth());
    expect(result.current.date.getFullYear()).toBe(today.getFullYear());
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

  it('goToday resets date to today', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-01-01'),
    });
    act(() => {
      result.current.goToday();
    });
    const today = new Date();
    expect(result.current.date.getDate()).toBe(today.getDate());
    expect(result.current.date.getMonth()).toBe(today.getMonth());
  });

  it('computes from/to for week view', () => {
    // 2026-05-20 is a Wednesday; week starts on Mon 2026-05-18, ends Sun 2026-05-24
    // from/to are expressed as local-day boundaries in UTC (timezone-aware)
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    // from must be the UTC equivalent of local Mon 2026-05-18 00:00:00
    expect(result.current.from).toBe(new Date(2026, 4, 18, 0, 0, 0, 0).toISOString());
    // to must be the UTC equivalent of local Sun 2026-05-24 23:59:59.999
    expect(result.current.to).toBe(new Date(2026, 4, 24, 23, 59, 59, 999).toISOString());
  });

  it('computes from/to for day view', () => {
    // from/to are expressed as local-day boundaries in UTC (timezone-aware)
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-05-20'),
    });
    expect(result.current.from).toBe(new Date(2026, 4, 20, 0, 0, 0, 0).toISOString());
    expect(result.current.to).toBe(new Date(2026, 4, 20, 23, 59, 59, 999).toISOString());
  });

  it('computes from/to for month view', () => {
    // from/to are expressed as local-day boundaries in UTC (timezone-aware)
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    expect(result.current.from).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).toISOString());
    expect(result.current.to).toBe(new Date(2026, 4, 31, 23, 59, 59, 999).toISOString());
  });

  // ---------------------------------------------------------------------------
  // Timezone-aware range bounds (TZ-BUG-2)
  // The range must cover the FULL LOCAL day, not just the UTC calendar day.
  // For UTC-3 (Argentina): local midnight = UTC+3h, local 23:59:59 = next UTC day at 02:59:59.
  // ---------------------------------------------------------------------------

  it('day view from/to covers the full local day (ARG UTC-3)', () => {
    // Machine timezone: America/Buenos_Aires (UTC-3, confirmed at test-write time)
    // Local 2026-06-01 00:00:00 = UTC 2026-06-01T03:00:00.000Z
    // Local 2026-06-01 23:59:59 = UTC 2026-06-02T02:59:59.000Z
    const localMidnightUTC = new Date(2026, 5, 1, 0, 0, 0, 0).toISOString();  // local midnight as UTC
    const localEndOfDayUTC = new Date(2026, 5, 1, 23, 59, 59, 999).toISOString(); // local EOD as UTC
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-06-01'),
    });
    // from must be at or before local midnight expressed in UTC
    expect(result.current.from <= localMidnightUTC).toBe(true);
    // to must be at or after local end-of-day expressed in UTC
    expect(result.current.to >= localEndOfDayUTC).toBe(true);
  });

  it('week view from/to covers the full local week (ARG UTC-3)', () => {
    // 2026-05-20 is Wednesday; local week: Mon 2026-05-18 to Sun 2026-05-24
    const weekStartLocalUTC = new Date(2026, 4, 18, 0, 0, 0, 0).toISOString();
    const weekEndLocalUTC   = new Date(2026, 4, 24, 23, 59, 59, 999).toISOString();
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    expect(result.current.from <= weekStartLocalUTC).toBe(true);
    expect(result.current.to >= weekEndLocalUTC).toBe(true);
  });

  it('month view from/to covers the full local month (ARG UTC-3)', () => {
    // May 2026: first day = May 1, last day = May 31
    const monthStartLocalUTC = new Date(2026, 4, 1, 0, 0, 0, 0).toISOString();
    const monthEndLocalUTC   = new Date(2026, 4, 31, 23, 59, 59, 999).toISOString();
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    expect(result.current.from <= monthStartLocalUTC).toBe(true);
    expect(result.current.to >= monthEndLocalUTC).toBe(true);
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
