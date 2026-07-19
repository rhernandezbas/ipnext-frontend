/**
 * TDD — RED phase: two fixes to the scheduling calendar.
 *
 * Fix 1 (REQ-ROLE-FILTER): Calendar resources must be ONLY users with role
 *   code === 'tecnico'. Non-technician RbacUsers must NOT appear as resource rows.
 *   The 'Sin asignar' row is always present (hardcoded in grid/sidebar).
 *
 * Fix 2 (REQ-SIDEBAR-FLAT): ResourceSidebar must render a FLAT list of resource
 *   rows — no groupHeader buttons between rows. This ensures 1:1 alignment with
 *   the grid (WeekView/DayView) which has no matching spacer rows for group headers.
 *
 *   Proof: sidebar row N must correspond exactly to allResources[N] in the grid,
 *   with no extra nodes between them.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';
import type { ScheduledTask } from '@/types/scheduling';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';

import SchedulingCalendarPage from '@/pages/scheduling/SchedulingCalendarPage';
import { ResourceSidebar } from '@/pages/scheduling/SchedulingCalendarPage/components/ResourceSidebar';
import type { CalendarResource } from '@/types/calendar';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useScheduling', () => ({
  useFilteredTasks: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
  useCreateTask: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
}));

vi.mock('@/pages/scheduling/SchedulingCalendarPage/hooks/useTasksForCalendar', () => ({
  useTasksForCalendar: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
}));

vi.mock('@/hooks/useAdmins', () => ({
  useTechnicians: vi.fn(() => ({ data: [], isLoading: false })),
  useAdmins: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartners: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTasksForCalendar } from '@/pages/scheduling/SchedulingCalendarPage/hooks/useTasksForCalendar';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRbacUser(overrides: Partial<RbacUserWithRolesDto> & Pick<RbacUserWithRolesDto, 'id' | 'name' | 'roles'>): RbacUserWithRolesDto {
  return {
    email: `${overrides.id}@test.com`,
    login: overrides.id ?? 'user',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    lastLoginAt: null,
    lockedUntil: null,
    ...overrides,
  };
}

const TECNICO_ROLE = { id: 'role-tecnico', code: 'tecnico', label: 'Técnico', isSystem: true };
const ADMIN_ROLE   = { id: 'role-admin',   code: 'administrador', label: 'Administrador', isSystem: true };
const VENTAS_ROLE  = { id: 'role-ventas',  code: 'ventas', label: 'Ventas', isSystem: true };

const TECH_ANA     = makeRbacUser({ id: 'rbac-ana',    name: 'Ana García',    roles: [TECNICO_ROLE] });

const ADMIN_USER   = makeRbacUser({ id: 'rbac-admin',  name: 'Carlos Admin',  roles: [ADMIN_ROLE] });
const VENTAS_USER  = makeRbacUser({ id: 'rbac-ventas', name: 'María Ventas',  roles: [VENTAS_ROLE] });
const MULTI_USER   = makeRbacUser({ id: 'rbac-multi',  name: 'Luis MultiRol', roles: [ADMIN_ROLE, TECNICO_ROLE] });

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
    contractId: null,
    partnerId: null,
    reporterId: null,
    assigneeId: null,
    assigneeName: null,
    watcherIds: [],
    travelTimeTo: null,
    travelTimeFrom: null,
    checklist: [],
    generalStatus: 'open',
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer',
    networkSiteId: null,
    networkSiteName: null,
    iclassCityCode: null,
    networkType: null,
    archivedAt: null,
    lastBroadcastAt: null,
    lastBroadcastByName: null,
    iclassStatus: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// Sentinel task — just enough to make isEmpty=false so week/day views render.
// Date chosen to fall in week of 2026-05-20 and day 2026-05-20.
const SENTINEL_TASK = makeTask({
  id: 'sentinel',
  title: 'Sentinel task',
  startDate: '2026-05-20T09:00:00Z',
  endDate: '2026-05-20T10:00:00Z',
});

function renderPage(url: string, rbacUsers: RbacUserWithRolesDto[], tasks: ScheduledTask[] = [SENTINEL_TASK]) {
  vi.mocked(useRbacUsers).mockReturnValue({ data: rbacUsers, isLoading: false } as unknown as ReturnType<typeof useRbacUsers>);
  vi.mocked(useTasksForCalendar).mockReturnValue({ data: tasks, isLoading: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTasksForCalendar>);

  const qc = makeQc();
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(Routes, null,
          React.createElement(Route, {
            path: '/admin/scheduling/calendars',
            element: React.createElement(SchedulingCalendarPage),
          })
        )
      )
    )
  );
}

// ── Fix 1 — Role filter (REQ-ROLE-FILTER) ─────────────────────────────────────

describe('SchedulingCalendarPage — only technicians shown as resources (REQ-ROLE-FILTER)', () => {
  it('renders resource rows ONLY for tecnico-role users in week view sidebar', () => {
    const { container } = renderPage(
      '/admin/scheduling/calendars?view=week&date=2026-05-20',
      [TECH_ANA, ADMIN_USER, VENTAS_USER]
    );

    const rows = container.querySelectorAll('[data-testid="resource-row"]');
    // Ana (tecnico) + Sin asignar = 2 rows; admin + ventas must NOT appear
    const rowTexts = Array.from(rows).map(r => r.textContent ?? '');

    expect(rowTexts.some(t => t.includes('Ana García'))).toBe(true);
    expect(rowTexts.some(t => t.includes('Sin asignar'))).toBe(true);

    // Non-technicians must NOT be shown
    expect(rowTexts.some(t => t.includes('Carlos Admin'))).toBe(false);
    expect(rowTexts.some(t => t.includes('María Ventas'))).toBe(false);
  });

  it('renders resource rows ONLY for tecnico-role users in day view sidebar', () => {
    const { container } = renderPage(
      '/admin/scheduling/calendars?view=day&date=2026-05-20',
      [TECH_ANA, ADMIN_USER]
    );

    const rows = container.querySelectorAll('[data-testid="resource-row"]');
    const rowTexts = Array.from(rows).map(r => r.textContent ?? '');

    expect(rowTexts.some(t => t.includes('Ana García'))).toBe(true);
    expect(rowTexts.some(t => t.includes('Sin asignar'))).toBe(true);
    expect(rowTexts.some(t => t.includes('Carlos Admin'))).toBe(false);
  });

  it('user with multiple roles (including tecnico) IS included as a resource', () => {
    const { container } = renderPage(
      '/admin/scheduling/calendars?view=week&date=2026-05-20',
      [MULTI_USER, ADMIN_USER]
    );

    const rows = container.querySelectorAll('[data-testid="resource-row"]');
    const rowTexts = Array.from(rows).map(r => r.textContent ?? '');

    expect(rowTexts.some(t => t.includes('Luis MultiRol'))).toBe(true);
    expect(rowTexts.some(t => t.includes('Carlos Admin'))).toBe(false);
  });

  it('user with NO roles at all is excluded', () => {
    const noRoleUser = makeRbacUser({ id: 'rbac-norole', name: 'Sin Rol User', roles: [] });

    const { container } = renderPage(
      '/admin/scheduling/calendars?view=week&date=2026-05-20',
      [TECH_ANA, noRoleUser]
    );

    const rows = container.querySelectorAll('[data-testid="resource-row"]');
    const rowTexts = Array.from(rows).map(r => r.textContent ?? '');

    expect(rowTexts.some(t => t.includes('Ana García'))).toBe(true);
    expect(rowTexts.some(t => t.includes('Sin Rol User'))).toBe(false);
  });

  it('task assigned to a tecnico appears in that tecnico slot in week view', () => {
    const task = makeTask({
      id: 'task-ana',
      title: 'Tarea de Ana',
      assigneeId: 'rbac-ana',
      startDate: '2026-05-20T09:00:00Z',
      endDate: '2026-05-20T10:00:00Z',
    });

    // Pass the task via renderPage so isEmpty=false and week view renders
    const { container } = renderPage(
      '/admin/scheduling/calendars?view=week&date=2026-05-20',
      [TECH_ANA, ADMIN_USER],
      [task]
    );

    const anaSlot = container.querySelector('[aria-label="Slot Ana García 2026-05-20"]');
    expect(anaSlot).not.toBeNull();
    expect(anaSlot).toHaveTextContent('Tarea de Ana');
  });
});

// ── Fix 2 — ResourceSidebar flat list (REQ-SIDEBAR-FLAT) ──────────────────────

describe('ResourceSidebar — flat list, no groupHeader buttons (REQ-SIDEBAR-FLAT)', () => {
  const RESOURCES: CalendarResource[] = [
    { id: 'r1', name: 'Ana García',    initials: 'AG', role: 'technician' },
    { id: 'r2', name: 'Rodrigo López', initials: 'RL', role: 'technician' },
  ];

  it('renders NO groupHeader buttons when given a flat list of technician resources', () => {
    render(React.createElement(ResourceSidebar, { resources: RESOURCES }));

    // There must be zero groupHeader buttons
    const groupHeaders = document.querySelectorAll('button[aria-expanded]');
    expect(groupHeaders).toHaveLength(0);
  });

  it('renders exactly N+1 resource-row elements (N resources + Sin asignar)', () => {
    render(React.createElement(ResourceSidebar, { resources: RESOURCES }));

    const rows = document.querySelectorAll('[data-testid="resource-row"]');
    // 2 technicians + 1 Sin asignar = 3 rows
    expect(rows).toHaveLength(RESOURCES.length + 1);
  });

  it('resource rows appear in the same order as the input array', () => {
    render(React.createElement(ResourceSidebar, { resources: RESOURCES }));

    const rows = document.querySelectorAll('[data-testid="resource-row"]');
    const ids = Array.from(rows).map(r => (r as HTMLElement).dataset.resourceId ?? '');

    // First N rows match RESOURCES order, last row is unassigned
    expect(ids[0]).toBe('r1');
    expect(ids[1]).toBe('r2');
    expect(ids[2]).toBe('unassigned');
  });

  it('sidebar rows align 1:1 with allResources order (no group-header offset)', () => {
    // This is the alignment contract: row index in sidebar == resource index in grid.
    // With groupHeaders removed, row i in sidebar == RESOURCES[i] == grid row i.
    render(React.createElement(ResourceSidebar, { resources: RESOURCES }));

    const rows = document.querySelectorAll('[data-testid="resource-row"]');
    const names = Array.from(rows).map(r => r.textContent?.trim() ?? '');

    // Row 0 → Ana García (grid row 0)
    expect(names[0]).toContain('Ana García');
    // Row 1 → Rodrigo López (grid row 1)
    expect(names[1]).toContain('Rodrigo López');
    // Row 2 → Sin asignar (grid row 2)
    expect(names[2]).toContain('Sin asignar');
  });

  it('empty resources renders only Sin asignar row (no groupHeaders)', () => {
    render(React.createElement(ResourceSidebar, { resources: [] }));

    const groupHeaders = document.querySelectorAll('button[aria-expanded]');
    expect(groupHeaders).toHaveLength(0);

    const rows = document.querySelectorAll('[data-testid="resource-row"]');
    expect(rows).toHaveLength(1); // only Sin asignar
    expect(rows[0]).toHaveTextContent('Sin asignar');
  });
});
