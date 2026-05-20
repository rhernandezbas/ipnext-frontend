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
    // 2026-05-20 is a Wednesday; week starts on Mon 2026-05-18
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=week&date=2026-05-20'),
    });
    // from = Monday 2026-05-18T00:00:00Z
    expect(result.current.from).toMatch(/^2026-05-18/);
    // to = Sunday 2026-05-24T23:59:59Z
    expect(result.current.to).toMatch(/^2026-05-24/);
  });

  it('computes from/to for day view', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=day&date=2026-05-20'),
    });
    expect(result.current.from).toBe('2026-05-20T00:00:00Z');
    expect(result.current.to).toBe('2026-05-20T23:59:59Z');
  });

  it('computes from/to for month view', () => {
    const { result } = renderHook(() => useCalendarUrlState(), {
      wrapper: wrapper('?view=month&date=2026-05-01'),
    });
    expect(result.current.from).toBe('2026-05-01T00:00:00Z');
    expect(result.current.to).toBe('2026-05-31T23:59:59Z');
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
