import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SchedulingProjectsPage from '@/pages/scheduling/SchedulingProjectsPage';

// The page drives off useProjects/useWorkflows (react-query). Mock the hook
// modules so the component renders without a QueryClientProvider.
vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
  useCreateProject: vi.fn(),
  useUpdateProject: vi.fn(),
  useDeleteProject: vi.fn(),
}));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';

const mockProjects = [
  { id: 'p1', title: 'Instalaciones', description: null, workflowId: 'wf-1', createdAt: '2026-01-01', updatedAt: '2026-01-01', taskCounts: { nuevo: 2, enProgreso: 1, hecho: 3, total: 6 } },
  { id: 'p2', title: 'Mantenimiento', description: 'Tareas de mantenimiento', workflowId: null, createdAt: '2026-01-02', updatedAt: '2026-01-02', taskCounts: { nuevo: 0, enProgreso: 0, hecho: 0, total: 0 } },
];

const idleMutation = { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCreateProject>;

function renderPage() {
  return render(<MemoryRouter><SchedulingProjectsPage /></MemoryRouter>);
}

describe('SchedulingProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProjects).mockReturnValue({ data: mockProjects, isLoading: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProjects>);
    vi.mocked(useWorkflows).mockReturnValue({ data: [{ id: 'wf-1', name: 'Default', description: null, stages: [], createdAt: '', updatedAt: '' }] } as unknown as ReturnType<typeof useWorkflows>);
    vi.mocked(useCreateProject).mockReturnValue(idleMutation);
    vi.mocked(useUpdateProject).mockReturnValue(idleMutation);
    vi.mocked(useDeleteProject).mockReturnValue(idleMutation);
  });

  it('renders heading "Proyectos"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Proyectos/i })).toBeInTheDocument();
  });

  it('renders a row per project', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Instalaciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mantenimiento' })).toBeInTheDocument();
  });

  it('renders without crashing while loading', () => {
    vi.mocked(useProjects).mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() } as unknown as ReturnType<typeof useProjects>);
    renderPage();
    expect(screen.getByRole('heading', { name: /Proyectos/i })).toBeInTheDocument();
  });

  it('does not render a manual "Recargar" refresh button (auto-sync via query invalidation)', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /Recargar/i })).toBeNull();
    expect(screen.queryByTitle(/Recargar/i)).toBeNull();
  });
});
