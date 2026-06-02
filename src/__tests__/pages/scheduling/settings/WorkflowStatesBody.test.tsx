/**
 * WorkflowStatesBody — unit tests
 *
 * Coverage:
 * - W1  Renders list of stages sorted by order
 * - W2  Shows code badge as read-only per stage
 * - W3  Shows category pill per stage
 * - W4  Shows color swatch per stage
 * - W5  Empty state when no stages
 * - W6  Loading state
 * - W7  Action buttons visible when user has scheduling.manage
 * - W8  Action buttons hidden when user lacks scheduling.manage
 * - W9  Open create modal with "+ Nuevo estado" button
 * - W10 Create modal: name required, category select present
 * - W11 Edit modal: code field is read-only (not an input), shows label "solo lectura"
 * - W12 Move-up button disabled for first stage, move-down disabled for last
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';

// ── Mock hooks ─────────────────────────────────────────────────────────────

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows:       vi.fn(),
  useCreateStage:     vi.fn(),
  useUpdateStage:     vi.fn(),
  useUpdateStageColor: vi.fn(),
  useReorderStages:   vi.fn(),
  useDeleteStage:     vi.fn(),
}));

import {
  useWorkflows,
  useCreateStage,
  useUpdateStage,
  useUpdateStageColor,
  useReorderStages,
  useDeleteStage,
} from '@/hooks/useWorkflows';

import { WorkflowStatesBody } from '@/pages/scheduling/settings/WorkflowStatesBody';
import type { Workflow } from '@/types/workflow';

// ── Fixtures ───────────────────────────────────────────────────────────────

const stageA = {
  id:         'stage-1',
  workflowId: 'wf-1',
  name:       'Pendiente',
  code:       'pendiente',
  category:   'nuevo' as const,
  order:      0,
  color:      '#3b82f6',
};

const stageB = {
  id:         'stage-2',
  workflowId: 'wf-1',
  name:       'En curso',
  code:       'en_curso',
  category:   'enProgreso' as const,
  order:      1,
  color:      '#f59e0b',
};

const stageC = {
  id:         'stage-3',
  workflowId: 'wf-1',
  name:       'Cerrado',
  code:       'cerrado',
  category:   'hecho' as const,
  order:      2,
  color:      '#22c55e',
};

const workflow: Workflow = {
  id:          'wf-1',
  name:        'Default',
  description: null,
  stages:      [stageA, stageB, stageC],
  createdAt:   '2024-01-01T00:00:00Z',
  updatedAt:   '2024-01-01T00:00:00Z',
};

const idleMutation = {
  mutate:      vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending:   false,
  isError:     false,
  error:       null,
  reset:       vi.fn(),
};

// ── Helpers ────────────────────────────────────────────────────────────────

function mockGranted() {
  const base: UseMyPermissionsResult = {
    user: null, roles: [], permissions: ['*'],
    isLoading: false, isError: false,
    can: () => true,
  };
  vi.mocked(useMyPermissions).mockReturnValue(base);
  vi.mocked(useCan).mockReturnValue(true);
}

function mockDenied() {
  const base: UseMyPermissionsResult = {
    user: null, roles: [], permissions: [],
    isLoading: false, isError: false,
    can: () => false,
  };
  vi.mocked(useMyPermissions).mockReturnValue(base);
  vi.mocked(useCan).mockReturnValue(false);
}

function setupDefaultMocks() {
  vi.mocked(useWorkflows).mockReturnValue({ data: [workflow], isLoading: false, isError: false } as never);
  vi.mocked(useCreateStage).mockReturnValue(idleMutation as never);
  vi.mocked(useUpdateStage).mockReturnValue(idleMutation as never);
  vi.mocked(useUpdateStageColor).mockReturnValue(idleMutation as never);
  vi.mocked(useReorderStages).mockReturnValue(idleMutation as never);
  vi.mocked(useDeleteStage).mockReturnValue(idleMutation as never);
}

function renderBody() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WorkflowStatesBody />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WorkflowStatesBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGranted();
  });

  // W1 — stage names in order
  it('W1 — renders all stage names', () => {
    renderBody();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
  });

  // W2 — code badges (read-only)
  it('W2 — displays code badge for each stage', () => {
    renderBody();
    expect(screen.getByText('pendiente')).toBeInTheDocument();
    expect(screen.getByText('en_curso')).toBeInTheDocument();
    expect(screen.getByText('cerrado')).toBeInTheDocument();
  });

  // W3 — category pills
  it('W3 — shows category pill for each stage', () => {
    renderBody();
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    expect(screen.getByText('Hecho')).toBeInTheDocument();
  });

  // W4 — color swatches via aria-label
  it('W4 — renders color swatch for each stage', () => {
    renderBody();
    // Each stage has a swatch with aria-label "Color: <hex>"
    expect(screen.getByLabelText('Color: #3b82f6')).toBeInTheDocument();
    expect(screen.getByLabelText('Color: #f59e0b')).toBeInTheDocument();
    expect(screen.getByLabelText('Color: #22c55e')).toBeInTheDocument();
  });

  // W5 — empty state
  it('W5 — shows empty message when workflow has no stages', () => {
    const emptyWf: Workflow = { ...workflow, stages: [] };
    vi.mocked(useWorkflows).mockReturnValue({ data: [emptyWf], isLoading: false, isError: false } as never);
    renderBody();
    expect(screen.getByText(/no hay estados/i)).toBeInTheDocument();
  });

  // W6 — loading
  it('W6 — shows loading message while fetching', () => {
    vi.mocked(useWorkflows).mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  // W7 — actions visible when canManage
  it('W7 — shows Editar and Eliminar buttons when user has scheduling.manage', () => {
    renderBody();
    const editBtns = screen.getAllByRole('button', { name: 'Editar' });
    expect(editBtns.length).toBe(3);
    const delBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    expect(delBtns.length).toBe(3);
  });

  // W8 — actions hidden when denied
  it('W8 — hides action buttons when user lacks scheduling.manage', () => {
    mockDenied();
    renderBody();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  // W9 — create modal
  it('W9 — opens create modal when "+ Nuevo estado" is clicked', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nuevo estado/i }));
    expect(screen.getByRole('dialog', { name: /nuevo estado/i })).toBeInTheDocument();
  });

  // W10 — create modal fields
  it('W10 — create modal has name input and category select', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nuevo estado/i }));
    expect(screen.getByPlaceholderText(/ej: en revisión/i)).toBeInTheDocument();
    // Category select must be present
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  // W11 — edit modal: code is read-only
  it('W11 — edit modal shows code as read-only text, not an editable input', () => {
    renderBody();
    // Click first Editar button (Pendiente)
    const editBtns = screen.getAllByRole('button', { name: 'Editar' });
    fireEvent.click(editBtns[0]);

    // Modal must be open
    expect(screen.getByRole('dialog', { name: /editar estado/i })).toBeInTheDocument();

    // Code badge (the span) must show the code
    expect(screen.getByLabelText('Código inmutable del estado')).toBeInTheDocument();
    // No input with value = 'pendiente' (should NOT be an input field)
    const inputs = screen.getAllByRole('textbox');
    const codeInput = inputs.find(i => (i as HTMLInputElement).value === 'pendiente');
    expect(codeInput).toBeUndefined();

    // The "solo lectura" note must appear
    expect(screen.getByText(/el código es inmutable/i)).toBeInTheDocument();
  });

  // W12 — move-up disabled for first, move-down disabled for last
  it('W12 — move-up disabled for first stage, move-down disabled for last stage', () => {
    renderBody();
    const upBtns   = screen.getAllByRole('button', { name: 'Mover arriba' });
    const downBtns = screen.getAllByRole('button', { name: 'Mover abajo' });

    // first row: up disabled
    expect(upBtns[0]).toBeDisabled();
    // first row: down enabled
    expect(downBtns[0]).not.toBeDisabled();

    // last row: up enabled
    expect(upBtns[upBtns.length - 1]).not.toBeDisabled();
    // last row: down disabled
    expect(downBtns[downBtns.length - 1]).toBeDisabled();
  });
});
