import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CalendarView, CalendarUrlState } from '@/types/calendar';
import type { TaskListFilter } from '@/types/scheduling';

// Returns Monday of the week containing the given date (ISO Mon-first week)
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // Mon = 0, Tue = 1, ..., Sun = 6
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}

function computeRange(view: CalendarView, date: Date): { from: string; to: string } {
  if (view === 'day') {
    const dateStr = toIsoDate(date);
    return {
      from: `${dateStr}T00:00:00Z`,
      to: `${dateStr}T23:59:59Z`,
    };
  }
  if (view === 'week') {
    const weekStart = getWeekStart(date);
    const weekEnd = addDays(weekStart, 6);
    return {
      from: `${toIsoDate(weekStart)}T00:00:00Z`,
      to: `${toIsoDate(weekEnd)}T23:59:59Z`,
    };
  }
  // month
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    from: `${toIsoDate(firstDay)}T00:00:00Z`,
    to: `${toIsoDate(lastDay)}T23:59:59Z`,
  };
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function computePeriodLabel(view: CalendarView, date: Date): string {
  if (view === 'day') {
    const day = date.getDate();
    const month = MONTH_NAMES[date.getMonth()].toLowerCase();
    const year = date.getFullYear();
    const weekday = WEEKDAY_SHORT[date.getDay()];
    return `${weekday}, ${day} ${month} ${year}`;
  }
  if (view === 'week') {
    const start = getWeekStart(date);
    const end = addDays(start, 6);
    const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3).toLowerCase()}`;
    const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3).toLowerCase()} ${end.getFullYear()}`;
    return `${startStr} – ${endStr}`;
  }
  // month
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function useCalendarUrlState(): CalendarUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get('view') as CalendarView) ?? 'week';

  const dateParam = searchParams.get('date');
  const date = useMemo(() => {
    if (dateParam) {
      const parsed = new Date(`${dateParam}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [dateParam]);

  const fullDay = searchParams.get('fullDay') === '1';

  const filter: TaskListFilter = useMemo(() => ({
    projectId: searchParams.get('projectId') ?? undefined,
    partnerId: searchParams.get('partnerId') ?? undefined,
    assigneeId: searchParams.get('assigneeId') ?? undefined,
    stageIds: searchParams.getAll('stageIds[]').length > 0
      ? searchParams.getAll('stageIds[]')
      : undefined,
  }), [searchParams]);

  const { from, to } = useMemo(() => computeRange(view, date), [view, date]);
  const periodLabel = useMemo(() => computePeriodLabel(view, date), [view, date]);

  const setView = useCallback((v: CalendarView) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', v);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setDate = useCallback((d: Date) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('date', toIsoDate(d));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setFilter = useCallback((patch: Partial<TaskListFilter>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (patch.projectId !== undefined) {
        if (patch.projectId) next.set('projectId', patch.projectId);
        else next.delete('projectId');
      }
      if (patch.partnerId !== undefined) {
        if (patch.partnerId) next.set('partnerId', patch.partnerId);
        else next.delete('partnerId');
      }
      if (patch.assigneeId !== undefined) {
        if (patch.assigneeId) next.set('assigneeId', patch.assigneeId);
        else next.delete('assigneeId');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleFullDay = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (next.get('fullDay') === '1') next.delete('fullDay');
      else next.set('fullDay', '1');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const goNext = useCallback(() => {
    let next: Date;
    if (view === 'day') next = addDays(date, 1);
    else if (view === 'week') next = addDays(date, 7);
    else next = addMonths(date, 1);
    setDate(next);
  }, [view, date, setDate]);

  const goPrev = useCallback(() => {
    let prev: Date;
    if (view === 'day') prev = addDays(date, -1);
    else if (view === 'week') prev = addDays(date, -7);
    else prev = addMonths(date, -1);
    setDate(prev);
  }, [view, date, setDate]);

  const goToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setDate(today);
  }, [setDate]);

  return {
    view,
    date,
    from,
    to,
    filter,
    fullDay,
    periodLabel,
    setView,
    setDate,
    setFilter,
    toggleFullDay,
    goNext,
    goPrev,
    goToday,
  };
}
