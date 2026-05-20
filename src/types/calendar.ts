import type { TaskListFilter } from './scheduling';

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;           // derived from task.startDate
  end: Date;             // derived from task.endDate (fallback: start + estimatedHours)
  resourceId: string;    // task.assigneeId ?? 'unassigned'
  stageCategory: 'nuevo' | 'enProgreso' | 'hecho';
  customerName?: string;
  address?: string;
}

export interface CalendarResource {
  id: string;
  name: string;
  initials: string;      // derived: first letter of each word, max 3 chars
  role: string;          // Admin.role value — used as group key
}

export interface CalendarUrlState {
  view: CalendarView;
  date: Date;
  from: string;          // ISO datetime, derived
  to: string;            // ISO datetime, derived
  filter: TaskListFilter;
  fullDay: boolean;
  periodLabel: string;   // human-readable label for the current period
  setView: (v: CalendarView) => void;
  setDate: (d: Date) => void;
  setFilter: (patch: Partial<TaskListFilter>) => void;
  toggleFullDay: () => void;
  goNext: () => void;
  goPrev: () => void;
  goToday: () => void;
}
