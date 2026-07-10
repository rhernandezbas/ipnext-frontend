/**
 * Tests for CreateTaskModal endDate mirror behavior (FIX 2).
 *
 * Desired behavior:
 * a. Changing startDate twice re-mirrors endDate both times (no stale guard)
 * b. After manually editing endDate, changing startDate does NOT change endDate
 * c. No initial endDate to protect on mount (CreateTaskModal always starts empty)
 *    — verified as a side effect of (a): the mirror fires even from a blank state.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

// ── Mock all hooks that CreateTaskModal calls ─────────────────────────────────
vi.mock('@/hooks/useCustomers', () => ({
  useClientDetail: vi.fn(() => ({ data: null })),
  useClientContracts: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: vi.fn(() => ({ data: [] })),
}));

// CustomerPicker uses its own internals — stub it
vi.mock(
  '@/components/molecules/CustomerPicker/CustomerPicker',
  () => ({
    CustomerPicker: () => null,
  }),
);

// NodeSelector ditto
vi.mock('@/components/NodeSelector', () => ({
  NodeSelector: () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const project: Project = {
  id: 'proj-1',
  title: 'Proyecto Test',
  isNetworkProject: false,
  workflowId: 'wf-1',
} as never;

const workflow: Workflow = {
  id: 'wf-1',
  name: 'WF Test',
  stages: [{ id: 'stage-1', name: 'Pendiente', order: 1 }],
} as never;

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderModal() {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  return {
    onCreate,
    onClose,
    ...render(
      <QueryClientProvider client={makeQC()}>
        <CreateTaskModal
          projects={[project]}
          workflows={[workflow]}
          technicians={[]}
          templates={[]}
          onClose={onClose}
          onCreate={onCreate}
          loading={false}
        />
      </QueryClientProvider>,
    ),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateTaskModal — endDate mirror behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) mirrors endDate = startDate + 1h on EVERY startDate change, not just the first', async () => {
    const user = userEvent.setup();
    renderModal();

    const startInput = screen.getByLabelText('Inicia') as HTMLInputElement;
    const endInput = screen.getByLabelText('Termina') as HTMLInputElement;

    // First change — sets 09:00, should mirror endDate to 10:00
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T09:00');

    await waitFor(() => {
      expect(endInput.value).toBe('2025-06-01T10:00');
    });

    // Second change — sets 14:00, should mirror endDate to 15:00 (NOT stuck at 10:00)
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T14:00');

    await waitFor(() => {
      expect(endInput.value).toBe('2025-06-01T15:00');
    });
  });

  it('(b) does NOT update endDate after user manually edited it', async () => {
    const user = userEvent.setup();
    renderModal();

    const startInput = screen.getByLabelText('Inicia') as HTMLInputElement;
    const endInput = screen.getByLabelText('Termina') as HTMLInputElement;

    // Set startDate — triggers auto-mirror
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T09:00');
    await waitFor(() => expect(endInput.value).toBe('2025-06-01T10:00'));

    // User manually edits endDate — now endDateTouched should be set
    await user.clear(endInput);
    await user.type(endInput, '2025-06-01T11:30');

    // Now change startDate again — endDate should NOT update
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T14:00');

    await waitFor(() => {
      // endDate should still be 11:30, NOT 15:00
      expect(endInput.value).toBe('2025-06-01T11:30');
    });
  });
});
