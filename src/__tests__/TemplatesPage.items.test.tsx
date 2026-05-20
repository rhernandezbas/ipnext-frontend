import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskTemplate } from '@/types/taskTemplate';

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(),
  useCreateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'new-1', name: 'New', description: null, category: 'other' }), isPending: false })),
  useUpdateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
  useDeleteTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
  useReplaceTemplateItems: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue([]), isPending: false })),
}));

// Mock dnd-kit
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

import SchedulingTemplatesPage from '@/pages/scheduling/SchedulingTemplatesPage';
import * as templateHooks from '@/hooks/useTaskTemplates';

const mockTemplateWithItems: TaskTemplate = {
  id: 'tpl-1',
  name: 'Instalación fibra',
  description: 'Checklist instalación',
  category: 'installation',
  items: [
    { id: 'item-a', templateId: 'tpl-1', text: 'Verificar señal', order: 0, createdAt: '', updatedAt: '' },
    { id: 'item-b', templateId: 'tpl-1', text: 'Configurar router', order: 1, createdAt: '', updatedAt: '' },
  ],
};

describe('SchedulingTemplatesPage — item editor in modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templateHooks.useTaskTemplates).mockReturnValue({
      data: [mockTemplateWithItems],
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof templateHooks.useTaskTemplates>);
  });

  it('opens edit modal with existing items', () => {
    render(<SchedulingTemplatesPage />);

    // Click edit button on first template row
    const editButtons = screen.getAllByTitle('Editar');
    fireEvent.click(editButtons[0]);

    // Should see modal with items
    expect(screen.getByText('Editar plantilla')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Verificar señal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Configurar router')).toBeInTheDocument();
  });

  it('save calls useReplaceTemplateItems with all current texts', async () => {
    const mockReplaceItems = vi.fn().mockResolvedValue([]);
    vi.mocked(templateHooks.useReplaceTemplateItems).mockReturnValue({
      mutateAsync: mockReplaceItems,
      isPending: false,
    } as ReturnType<typeof templateHooks.useReplaceTemplateItems>);

    const mockUpdateTemplate = vi.fn().mockResolvedValue({});
    vi.mocked(templateHooks.useUpdateTaskTemplate).mockReturnValue({
      mutateAsync: mockUpdateTemplate,
      isPending: false,
    } as ReturnType<typeof templateHooks.useUpdateTaskTemplate>);

    render(<SchedulingTemplatesPage />);

    // Open edit modal
    const editButtons = screen.getAllByTitle('Editar');
    fireEvent.click(editButtons[0]);

    // Save
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockReplaceItems).toHaveBeenCalledWith({
        id: 'tpl-1',
        items: [{ text: 'Verificar señal' }, { text: 'Configurar router' }],
      });
    });
  });

  it('delete item then save calls useReplaceTemplateItems with 1 text', async () => {
    const mockReplaceItems = vi.fn().mockResolvedValue([]);
    vi.mocked(templateHooks.useReplaceTemplateItems).mockReturnValue({
      mutateAsync: mockReplaceItems,
      isPending: false,
    } as ReturnType<typeof templateHooks.useReplaceTemplateItems>);

    vi.mocked(templateHooks.useUpdateTaskTemplate).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as ReturnType<typeof templateHooks.useUpdateTaskTemplate>);

    render(<SchedulingTemplatesPage />);

    // Open edit modal
    const editButtons = screen.getAllByTitle('Editar');
    fireEvent.click(editButtons[0]);

    // Delete first item
    const deleteButtons = screen.getAllByTitle('Eliminar paso');
    fireEvent.click(deleteButtons[0]);

    // Save
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockReplaceItems).toHaveBeenCalledWith({
        id: 'tpl-1',
        items: [{ text: 'Configurar router' }],
      });
    });
  });
});
