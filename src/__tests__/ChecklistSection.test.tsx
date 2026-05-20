import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskChecklistItem } from '@/types/scheduling';

// Mock all hooks
vi.mock('@/hooks/useScheduling', () => ({
  useAddChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useToggleChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRemoveChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReorderChecklist: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useClearChecklist: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useAssignTemplateToTask: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(() => ({ data: [], isLoading: false })),
}));

// Mock dnd-kit to avoid jsdom drag issues
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  })),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

import { ChecklistSection } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ChecklistSection';
import * as schedulingHooks from '@/hooks/useScheduling';

function makeItem(overrides: Partial<TaskChecklistItem> = {}): TaskChecklistItem {
  return {
    id: 'item-1',
    taskId: 'task-1',
    text: 'Test item',
    done: false,
    order: 0,
    fromTemplateItemId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ChecklistSection', () => {
  const TASK_ID = 'task-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3 mock items as checkboxes', () => {
    const items = [
      makeItem({ id: 'a', text: 'First step' }),
      makeItem({ id: 'b', text: 'Second step', order: 1 }),
      makeItem({ id: 'c', text: 'Third step', order: 2 }),
    ];
    render(<ChecklistSection taskId={TASK_ID} checklist={items} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(screen.getByText('First step')).toBeInTheDocument();
    expect(screen.getByText('Second step')).toBeInTheDocument();
    expect(screen.getByText('Third step')).toBeInTheDocument();
  });

  it('clicking a checkbox calls useToggleChecklistItem mutateAsync with correct itemId', () => {
    const mockMutate = vi.fn().mockResolvedValue({});
    vi.mocked(schedulingHooks.useToggleChecklistItem).mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    } as ReturnType<typeof schedulingHooks.useToggleChecklistItem>);

    const items = [makeItem({ id: 'item-x' })];
    render(<ChecklistSection taskId={TASK_ID} checklist={items} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockMutate).toHaveBeenCalledWith('item-x');
  });

  it('shows empty state and "Añadir elemento" input when checklist is empty', () => {
    render(<ChecklistSection taskId={TASK_ID} checklist={[]} />);
    expect(screen.getByText(/sin elementos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/añadir elemento/i)).toBeInTheDocument();
  });

  it('shows progress indicator when items exist', () => {
    const items = [
      makeItem({ id: 'a', done: true }),
      makeItem({ id: 'b', done: false, order: 1 }),
    ];
    render(<ChecklistSection taskId={TASK_ID} checklist={items} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });
});
