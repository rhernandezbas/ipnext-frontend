import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SchedulingProjectsPage from '@/pages/scheduling/SchedulingProjectsPage';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

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

  // ── #40b fix: network projects drill down to the Nodos list ─────────────────
  // The customer Tareas list now filters kind='customer'. A NETWORK project (its
  // tasks are kind='network') must therefore drill down to /admin/scheduling/nodos
  // instead of /admin/scheduling/tasks, or it would land on a zero-row list.
  describe('drill-down respects isNetworkProject', () => {
    // createdAt drives the default (id-column) sort: network first, customer second.
    const networkProject = {
      id: 'np-1', title: 'RED - FIBRA', description: null, workflowId: 'wf-1', visible: true,
      isNetworkProject: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      taskCounts: { nuevo: 5, enProgreso: 4, hecho: 7, total: 16 },
    };
    const customerProject = {
      id: 'cp-1', title: 'Instalaciones', description: null, workflowId: 'wf-1', visible: true,
      isNetworkProject: false, createdAt: '2026-01-02', updatedAt: '2026-01-02',
      taskCounts: { nuevo: 2, enProgreso: 1, hecho: 3, total: 6 },
    };

    beforeEach(() => {
      vi.mocked(useProjects).mockReturnValue({ data: [networkProject, customerProject], isLoading: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProjects>);
    });

    it('navigates a network project title to /admin/scheduling/nodos', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'RED - FIBRA' }));
      expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/nodos?projectId=np-1');
    });

    it('navigates a network project count link preserving the stageCategory variant', () => {
      renderPage();
      // Two rows → two "nuevo" count links; first row is the network project.
      const nuevoLinks = screen.getAllByTitle('Ver tareas nuevas de este proyecto');
      fireEvent.click(nuevoLinks[0]);
      expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/nodos?projectId=np-1&stageCategory=nuevo');
    });

    it('navigates the network project "Ver tareas" action to /admin/scheduling/nodos', () => {
      renderPage();
      const verTareas = screen.getAllByTitle('Ver tareas');
      // First row is the network project (insertion order).
      fireEvent.click(verTareas[0]);
      expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/nodos?projectId=np-1');
    });

    it('keeps a normal (customer) project on /admin/scheduling/tasks', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Instalaciones' }));
      expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/tasks?projectId=cp-1');
    });

    it('keeps a normal project count link on /admin/scheduling/tasks with stageCategory', () => {
      renderPage();
      // customer "enProgreso" count is 1 — target via its title.
      const links = screen.getAllByTitle('Ver tareas en progreso de este proyecto');
      // Second row is the customer project.
      fireEvent.click(links[1]);
      expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/tasks?projectId=cp-1&stageCategory=enProgreso');
    });
  });
});
