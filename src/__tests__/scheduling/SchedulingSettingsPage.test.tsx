import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hook mocks: every config body pulls its data from these hooks ────────────
vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTaskCategory: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTaskCategory: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteTaskCategory: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTaskPriority: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTaskPriority: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteTaskPriority: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(() => ({ data: [], isLoading: false })),
  useUpdateStageColor: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
  useCreateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReplaceTemplateItems: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

// dnd-kit is used by the templates body — stub it out
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
  useSortable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: undefined })),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr: unknown[]) => arr),
}));
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: vi.fn(() => '') } } }));

import SchedulingSettingsPage from '@/pages/scheduling/SchedulingSettingsPage';

function renderPage() {
  return render(<SchedulingSettingsPage />);
}

describe('SchedulingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('renders a single Configuración header (no duplicated section breadcrumbs)', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument();
    // The embedded bodies must NOT carry their own h1 titles
    expect(screen.queryByRole('heading', { level: 1, name: 'Plantillas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Prioridades' })).not.toBeInTheDocument();
  });

  it('renders the four config tabs', () => {
    renderPage();
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual(['Categorías', 'Prioridades', 'Colores de estados', 'Plantillas']);
  });

  it('shows the Categorías body by default', () => {
    renderPage();
    expect(screen.getByText(/No hay categorías/i)).toBeInTheDocument();
  });

  it('switches to the Plantillas tab and shows its body', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Plantillas' }));
    expect(screen.getByPlaceholderText('Buscar plantilla...')).toBeInTheDocument();
  });

  it('opens directly on the tab named in the URL hash', () => {
    window.location.hash = '#plantillas';
    renderPage();
    expect(screen.getByRole('tab', { name: 'Plantillas' })).toHaveAttribute('aria-selected', 'true');
  });
});
