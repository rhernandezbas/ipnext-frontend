import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useIClassClosure', () => ({
  useInFlightTasks: vi.fn(),
  useReconcileTask: vi.fn(),
  useRunClosureBackfill: vi.fn(),
}));

import {
  useInFlightTasks,
  useReconcileTask,
  useRunClosureBackfill,
} from '@/hooks/useIClassClosure';
import { InFlightTasksTable } from '@/pages/scheduling/settings/InFlightTasksTable';

const task1 = {
  id: 'task-1',
  sequenceNumber: 101,
  title: 'Instalar fibra',
  customerName: 'ACME SA',
  iclassOrderCode: 'OS-777',
};

const task2 = {
  id: 'task-2',
  sequenceNumber: 102,
  title: 'Revisión nodo',
  customerName: 'Globex',
  iclassOrderCode: 'OS-888',
};

function mockInFlight(items: typeof task1[]) {
  vi.mocked(useInFlightTasks).mockReturnValue({
    data: { items },
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof useInFlightTasks>);
}

function mockReconcile(overrides: Partial<ReturnType<typeof useReconcileTask>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue({
    mirrored: 1,
    transitioned: 1,
    skippedNotClosed: 0,
    skippedNotOurs: 0,
    skippedUnchanged: 0,
    failed: 0,
  });
  vi.mocked(useReconcileTask).mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useReconcileTask>);
  return mutateAsync;
}

function mockBackfill(overrides: Partial<ReturnType<typeof useRunClosureBackfill>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue({ queued: true });
  vi.mocked(useRunClosureBackfill).mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRunClosureBackfill>);
  return mutateAsync;
}

function renderTable() {
  return render(
    <MemoryRouter>
      <InFlightTasksTable />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

// Scenario: Page lists in-flight tasks
describe('InFlightTasksTable — rows', () => {
  it('renders one row per task with seq, title, customerName and iclassOrderCode', () => {
    mockInFlight([task1, task2]);
    mockReconcile();
    mockBackfill();
    renderTable();

    expect(screen.getByText(/#101/)).toBeInTheDocument();
    expect(screen.getByText('Instalar fibra')).toBeInTheDocument();
    expect(screen.getByText('ACME SA')).toBeInTheDocument();
    expect(screen.getByText('OS-777')).toBeInTheDocument();

    expect(screen.getByText(/#102/)).toBeInTheDocument();
    expect(screen.getByText('Revisión nodo')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('OS-888')).toBeInTheDocument();
  });

  it('renders a "Reconciliar" button per row', () => {
    mockInFlight([task1, task2]);
    mockReconcile();
    mockBackfill();
    renderTable();

    const buttons = screen.getAllByRole('button', { name: /^reconciliar$/i });
    expect(buttons).toHaveLength(2);
  });
});

// Scenario: Per-row reconcile removes closed task from list
describe('InFlightTasksTable — per-row reconcile', () => {
  it('calls reconcileTask with the row id when "Reconciliar" is clicked', async () => {
    mockInFlight([task1]);
    const mutateAsync = mockReconcile();
    mockBackfill();
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /^reconciliar$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('task-1'));
  });

  it('shows inline counts after a reconcile that mirrored/transitioned', async () => {
    mockInFlight([task1]);
    mockReconcile();
    mockBackfill();
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /^reconciliar$/i }));

    // mirrored:1, transitioned:1 → numeric counts surface inline
    await waitFor(() => expect(screen.getByText(/espejad/i)).toBeInTheDocument());
    expect(screen.getByText(/transicionad/i)).toBeInTheDocument();
  });

  it('shows "no se encontró cierre reciente" when mirrored===0 && transitioned===0', async () => {
    mockInFlight([task1]);
    mockReconcile({
      mutateAsync: vi.fn().mockResolvedValue({
        mirrored: 0,
        transitioned: 0,
        skippedNotClosed: 1,
        skippedNotOurs: 0,
        skippedUnchanged: 0,
        failed: 0,
      }),
    } as never);
    mockBackfill();
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /^reconciliar$/i }));

    await waitFor(() =>
      expect(screen.getByText(/no se encontró cierre reciente/i)).toBeInTheDocument(),
    );
  });
});

// Scenario: "Reconciliar todas" triggers batch backfill
describe('InFlightTasksTable — batch reconcile', () => {
  it('calls the backfill mutation when "Reconciliar todas" is clicked', async () => {
    mockInFlight([task1, task2]);
    mockReconcile();
    const backfill = mockBackfill();
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /reconciliar todas/i }));

    await waitFor(() => expect(backfill).toHaveBeenCalledTimes(1));
  });
});

// Scenario: Empty state shown when no tasks are in-flight
describe('InFlightTasksTable — empty state', () => {
  it('renders an empty state and no data rows when the list is empty', () => {
    mockInFlight([]);
    mockReconcile();
    mockBackfill();
    renderTable();

    expect(screen.getByText(/no hay (os|órdenes).*in-flight/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reconciliar$/i })).not.toBeInTheDocument();
  });
});

// Loading state
describe('InFlightTasksTable — loading', () => {
  it('renders a loading message when isLoading is true', () => {
    vi.mocked(useInFlightTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useInFlightTasks>);
    mockReconcile();
    mockBackfill();
    renderTable();

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
