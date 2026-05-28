/**
 * Vitest tests for SchedulingCalendarPage.
 * Uses MemoryRouter for URL control. All external hooks are mocked.
 * Change: scheduling-calendar-view, Phase 10
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import type { ScheduledTask } from '@/types/scheduling';

// Top-level import (ESM / Vitest compatible)
import SchedulingCalendarPage from '@/pages/scheduling/SchedulingCalendarPage';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useScheduling', () => ({
  useFilteredTasks: vi.fn(),
  useCreateTask: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}));

vi.mock('@/hooks/useAdmins', () => ({
  useTechnicians: vi.fn(() => ({ data: [], isLoading: false })),
  useAdmins: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartners: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { useFilteredTasks } from '@/hooks/useScheduling';
import { useTechnicians } from '@/hooks/useAdmins';
import { useProjects } from '@/hooks/useProjects';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'task-1',
    sequenceNumber: 1,
    title: 'Test task',
    description: null,
    priority: 'normal',
    estimatedHours: 1,
    address: null,
    coordinates: null,
    category: 'installation',
    projectId: null,
    projectName: null,
    completedAt: null,
    notes: null,
    stageId: 'stage-1',
    stageCategory: 'nuevo',
    startDate: '2026-05-20T09:00:00Z',
    endDate: '2026-05-20T10:00:00Z',
    customerId: null,
    customerName: null,
    customerCity: null,
    serviceId: null,
    partnerId: null,
    reporterId: null,
    assigneeId: null,
    assigneeName: null,
    watcherIds: [],
    travelTimeTo: null,
    travelTimeFrom: null,
    checklist: [],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// LocationDisplay captures URL changes in tests
const LocationDisplay = () => {
  const loc = useLocation();
  return React.createElement('div', { 'data-testid': 'location', 'data-search': loc.search }, null);
};

function renderWithRouter(url: string, tasks: ScheduledTask[] = [], isLoading = false) {
  vi.mocked(useFilteredTasks).mockReturnValue({
    data: tasks,
    isLoading,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useFilteredTasks>);
  vi.mocked(useTechnicians).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useTechnicians>);
  vi.mocked(useProjects).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useProjects>);

  const qc = makeQc();

  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/admin/scheduling/calendars',
            element: React.createElement(React.Fragment, null,
              React.createElement(SchedulingCalendarPage),
              React.createElement(LocationDisplay)
            ),
          }),
          React.createElement(Route, {
            path: '/admin/scheduling/tasks/:id',
            element: React.createElement('div', { 'data-testid': 'task-detail' }, 'Task Detail'),
          })
        )
      )
    )
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SchedulingCalendarPage — page structure (REQ-PAGE)', () => {
  it('renders breadcrumb "Scheduling /"', () => {
    renderWithRouter('/admin/scheduling/calendars');
    expect(screen.getByText('Scheduling /')).toBeInTheDocument();
  });

  it('renders h1 "Calendario"', () => {
    renderWithRouter('/admin/scheduling/calendars');
    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
  });

  it('renders "Añadir tarea" primary button', () => {
    renderWithRouter('/admin/scheduling/calendars');
    const addBtns = screen.getAllByRole('button', { name: /Añadir tarea/i });
    expect(addBtns.length).toBeGreaterThan(0);
  });

  it('renders "Filtrar" secondary button', () => {
    renderWithRouter('/admin/scheduling/calendars');
    expect(screen.getByRole('button', { name: /Filtrar/i })).toBeInTheDocument();
  });

  it('renders view selector buttons (Día, Semana, Mes)', () => {
    renderWithRouter('/admin/scheduling/calendars');
    expect(screen.getByRole('button', { name: 'Día' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes' })).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — view switching (REQ-VIEW-MONTH / REQ-VIEW-DAY)', () => {
  it('clicking "Día" updates URL to ?view=day', () => {
    renderWithRouter('/admin/scheduling/calendars?view=week');
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    const location = screen.getByTestId('location');
    expect(location.getAttribute('data-search')).toContain('view=day');
  });

  it('clicking "Mes" updates URL to ?view=month', () => {
    renderWithRouter('/admin/scheduling/calendars?view=week&date=2026-05-20');
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    const location = screen.getByTestId('location');
    expect(location.getAttribute('data-search')).toContain('view=month');
  });

  it('month view renders day headers (Lun, Mar, Mié...)', () => {
    renderWithRouter('/admin/scheduling/calendars?view=month&date=2026-05-20');
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Mié')).toBeInTheDocument();
    expect(screen.getByText('Jue')).toBeInTheDocument();
    expect(screen.getByText('Vie')).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — navigation (REQ-NAV)', () => {
  it('clicking › in week view advances ?date by 7 days', () => {
    renderWithRouter('/admin/scheduling/calendars?view=week&date=2026-05-20');
    fireEvent.click(screen.getByRole('button', { name: 'Período siguiente' }));
    const location = screen.getByTestId('location');
    expect(location.getAttribute('data-search')).toContain('date=2026-05-27');
  });

  it('clicking ‹ in week view retreats ?date by 7 days', () => {
    renderWithRouter('/admin/scheduling/calendars?view=week&date=2026-05-27');
    fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }));
    const location = screen.getByTestId('location');
    expect(location.getAttribute('data-search')).toContain('date=2026-05-20');
  });

  it('clicking "Hoy" sets ?date to today', () => {
    renderWithRouter('/admin/scheduling/calendars?view=week&date=2026-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    const location = screen.getByTestId('location');
    // Mirror goToday() exactly: local midnight, then serialized via toISOString.
    // Computing the expectation any other way (e.g. a bare new Date().toISOString())
    // drifts by a day once UTC has rolled past local midnight, flaking at night.
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const today = t.toISOString().slice(0, 10);
    expect(location.getAttribute('data-search')).toContain(`date=${today}`);
  });

  it('renders period label for month view', () => {
    renderWithRouter('/admin/scheduling/calendars?view=month&date=2026-05-01');
    expect(screen.getByText(/Mayo 2026/i)).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — month view tasks (REQ-VIEW-MONTH)', () => {
  it('renders event pill on the correct day', () => {
    renderWithRouter(
      '/admin/scheduling/calendars?view=month&date=2026-05-01',
      [makeTask({ id: 'task-1', title: 'Instalación cliente', startDate: '2026-05-20T09:00:00Z' })]
    );
    expect(screen.getByText('Instalación cliente')).toBeInTheDocument();
  });

  it('shows "+2 más" when 5 tasks on same day', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `task-${i}`, title: `Tarea ${i}`, startDate: '2026-05-20T09:00:00Z' })
    );
    renderWithRouter('/admin/scheduling/calendars?view=month&date=2026-05-01', tasks);
    expect(screen.getByText('+2 más')).toBeInTheDocument();
  });

  it('shows empty state when no tasks in month', () => {
    renderWithRouter('/admin/scheduling/calendars?view=month&date=2026-05-01', []);
    expect(screen.getByText(/Sin tareas en este rango/i)).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — URL state (REQ-URL-SYNC)', () => {
  it('mounts with ?view=day and shows "Día completo" toggle', () => {
    renderWithRouter('/admin/scheduling/calendars?view=day&date=2026-05-20');
    expect(screen.getByRole('button', { name: 'Día completo' })).toBeInTheDocument();
  });

  it('?fullDay=1 shows "Día completo" toggle as pressed', () => {
    renderWithRouter('/admin/scheduling/calendars?view=day&date=2026-05-20&fullDay=1');
    const toggleBtn = screen.getByRole('button', { name: 'Día completo' });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking "Día completo" toggle updates URL to include fullDay=1', () => {
    renderWithRouter('/admin/scheduling/calendars?view=day&date=2026-05-20');
    fireEvent.click(screen.getByRole('button', { name: 'Día completo' }));
    const location = screen.getByTestId('location');
    expect(location.getAttribute('data-search')).toContain('fullDay=1');
  });

  it('filter panel opens on clicking Filtrar', () => {
    renderWithRouter('/admin/scheduling/calendars');
    fireEvent.click(screen.getByRole('button', { name: /Filtrar/i }));
    expect(screen.getByText('Filtros')).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — event click (REQ-CLICK-EVENT)', () => {
  it('clicking an event pill navigates to /admin/scheduling/tasks/:id', () => {
    renderWithRouter(
      '/admin/scheduling/calendars?view=month&date=2026-05-01',
      [makeTask({ id: 'task-abc', title: 'Click me', startDate: '2026-05-20T09:00:00Z' })]
    );
    const pill = screen.getByTestId('event-pill');
    fireEvent.click(pill);
    // After navigation, the task detail page renders
    expect(screen.getByTestId('task-detail')).toBeInTheDocument();
  });
});

describe('SchedulingCalendarPage — create modal', () => {
  it('clicking header "Añadir tarea" opens the dialog', () => {
    renderWithRouter('/admin/scheduling/calendars');
    const addBtns = screen.getAllByRole('button', { name: /Añadir tarea/i });
    fireEvent.click(addBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
