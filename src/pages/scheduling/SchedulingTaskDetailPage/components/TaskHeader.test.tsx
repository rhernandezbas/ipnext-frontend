/**
 * TaskHeader — back-navigation tests (#126)
 * TDD: tests written BEFORE implementation (RED → GREEN → REFACTOR)
 *
 * What we verify:
 * 1. Con location.state.from presente → el botón atrás navega al from real.
 * 2. Sin state (entrada directa) → fallback a '/admin/scheduling/tasks' (NO a /projects).
 * 3. TasksTableView pasa state.from con la ruta del componente padre al navegar
 *    al detalle desde el menú de acciones.
 *
 * Mock strategy:
 * - react-router-dom se mockea para controlar useNavigate + useLocation.
 * - Los hooks pesados de TaskHeader (useFeatureFlag, useCan, StageSelect,
 *   PrioritySelect, CloseIClassOSModal) se mockean para no depender del contexto
 *   real de la app.
 * - setup.ts ya mockea useMyPermissions/useCan → otorga todos los permisos.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ScheduledTask } from '@/types/scheduling';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
let mockLocationState: unknown = undefined;

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/admin/scheduling/tasks/abc',
      search: '',
      hash: '',
      state: mockLocationState,
      key: 'default',
    }),
  };
});

// Stub heavy components so TaskHeader renders without their real dependencies.
vi.mock('@/components/molecules/StageSelect/StageSelect', () => ({
  StageSelect: () => <div data-testid="stage-select" />,
}));
vi.mock('@/components/molecules/PrioritySelect/PrioritySelect', () => ({
  PrioritySelect: () => <div data-testid="priority-select" />,
}));
vi.mock('@/components/auth/Can', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/molecules/IClassStatusBadge/IClassStatusBadge', () => ({
  IClassStatusBadge: () => null,
}));
vi.mock('@/components/molecules/CloseIClassOSModal/CloseIClassOSModal', () => ({
  CloseIClassOSModal: () => null,
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(() => ({ data: { enabled: false } })),
}));

import { TaskHeader } from './TaskHeader';

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeTask(over: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'task-1',
    sequenceNumber: 42,
    title: 'Tarea de prueba',
    projectId: 'proj-1',
    projectName: 'Proyecto X',
    assigneeId: null,
    assigneeName: null,
    partnerId: null,
    stageId: 'stage-1',
    stageCategory: 'pending',
    stageName: 'Pendiente',
    address: 'Calle Falsa 123',
    startDate: null,
    endDate: null,
    travelTimeTo: null,
    travelTimeFrom: null,
    isClosed: false,
    generalStatus: 'open',
    priority: 'Media',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    reporterId: null,
    reporterName: null,
    customerId: null,
    customerName: null,
    contractId: null,
    customerCity: null,
    iclassOrderCode: null,
    iclassStatus: null,
    iclassCityCode: null,
    kind: 'standard',
    networkType: null,
    reviewedByInventory: false,
    ...over,
  } as ScheduledTask;
}

function renderHeader(task = makeTask()) {
  return render(
    <TaskHeader
      task={task}
      stages={[]}
      priorities={[]}
      onTitleSave={vi.fn().mockResolvedValue(undefined)}
      onStageMove={vi.fn().mockResolvedValue(undefined)}
      onPriorityChange={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn()}
      onSetStatus={vi.fn()}
      isAdmin={false}
      isSaving={false}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskHeader — botón atrás (#126)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = undefined;
  });

  it('navega al from real cuando location.state.from está presente', async () => {
    mockLocationState = { from: '/admin/scheduling/tasks?page=2' };
    renderHeader();

    const backBtn = screen.getByRole('button', { name: /volver/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scheduling/tasks?page=2');
  });

  it('sin state cae al fallback /admin/scheduling/tasks (NO a /projects)', async () => {
    mockLocationState = undefined;
    renderHeader();

    const backBtn = screen.getByRole('button', { name: /volver/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scheduling/tasks');
    // Garantía explícita: nunca debe ir a /projects
    expect(mockNavigate).not.toHaveBeenCalledWith('/admin/scheduling/projects');
  });

  it('con state null cae igualmente al fallback /admin/scheduling/tasks', async () => {
    mockLocationState = null;
    renderHeader();

    const backBtn = screen.getByRole('button', { name: /volver/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scheduling/tasks');
  });

  it('con state.from vacío cae al fallback /admin/scheduling/tasks', async () => {
    mockLocationState = { from: '' };
    renderHeader();

    const backBtn = screen.getByRole('button', { name: /volver/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scheduling/tasks');
  });

  it('navega a la ruta de Tareas Nodos cuando se viene desde ahí', async () => {
    mockLocationState = { from: '/admin/scheduling/nodos' };
    renderHeader();

    const backBtn = screen.getByRole('button', { name: /volver/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scheduling/nodos');
  });
});
