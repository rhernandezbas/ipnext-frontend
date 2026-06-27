import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useIClassClosure', () => ({
  usePendingList: vi.fn(),
}));

import { usePendingList } from '@/hooks/useIClassClosure';
import { ClosureProgressTable } from '@/pages/scheduling/settings/ClosureProgressTable';

const item1 = {
  iclassId: 'OS-100',
  scheduledTaskId: 'task-abc',
  commentPosted: true,
  inventoryBuilt: false,
  auditDone: false,
  auditAttempts: 2,
  task: { id: 'task-abc', sequenceNumber: 7, title: 'Instalar fibra' },
};

const item2 = {
  iclassId: 'OS-200',
  scheduledTaskId: 'task-xyz',
  commentPosted: false,
  inventoryBuilt: true,
  auditDone: true,
  auditAttempts: 3,
  task: { id: 'task-xyz', sequenceNumber: 12, title: 'Revisión nodo' },
};

const itemNoTask = {
  iclassId: 'OS-300',
  scheduledTaskId: null,
  commentPosted: false,
  inventoryBuilt: false,
  auditDone: false,
  auditAttempts: 0,
  task: null,
};

function mockPendingList(items: typeof item1[], total?: number) {
  vi.mocked(usePendingList).mockReturnValue({
    data: { items, total: total ?? items.length },
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePendingList>);
}

function renderTable() {
  return render(
    <MemoryRouter>
      <ClosureProgressTable />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

// REQ-LIST-3 SC1: Renders rows with task link
describe('ClosureProgressTable — rows with task link', () => {
  it('renders 2 rows when usePendingList returns 2 items', () => {
    mockPendingList([item1, item2]);
    renderTable();
    // Each row shows the iclassId
    expect(screen.getByText('OS-100')).toBeInTheDocument();
    expect(screen.getByText('OS-200')).toBeInTheDocument();
  });

  it('renders comment status indicators for each row', () => {
    mockPendingList([item1, item2]);
    renderTable();
    // item1: commentPosted=true → ✓ indicator; item2: commentPosted=false → ✗
    const checkmarks = screen.getAllByText('✓');
    const crosses = screen.getAllByText('✗');
    expect(checkmarks.length).toBeGreaterThan(0);
    expect(crosses.length).toBeGreaterThan(0);
  });

  it('renders a clickable task link for items with a linked task', () => {
    mockPendingList([item1]);
    renderTable();
    // Link shows "#sequenceNumber · title"
    const link = screen.getByRole('link', { name: /#7.*Instalar fibra/i });
    expect(link).toBeInTheDocument();
  });

  it('shows auditAttempts count for each row', () => {
    mockPendingList([item1]);
    renderTable();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// REQ-LIST-3 SC2: Row without task link renders dash placeholder
describe('ClosureProgressTable — null task', () => {
  it('renders a dash placeholder when task is null (no broken link)', () => {
    mockPendingList([itemNoTask as unknown as typeof item1]);
    renderTable();
    // Should NOT render a link element for the task column
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Should render a dash or placeholder
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// REQ-LIST-3 SC3: Empty state
describe('ClosureProgressTable — empty state', () => {
  it('renders an empty-state message (not an empty table body) when list is empty', () => {
    mockPendingList([], 0);
    renderTable();
    // Empty state text visible
    expect(screen.getByText(/sin side-effects pendientes/i)).toBeInTheDocument();
    // No data rows present
    expect(screen.queryByRole('row', { name: /OS-/i })).not.toBeInTheDocument();
  });
});

// Loading state
describe('ClosureProgressTable — loading state', () => {
  it('renders a loading skeleton when isLoading is true', () => {
    vi.mocked(usePendingList).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof usePendingList>);

    renderTable();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
