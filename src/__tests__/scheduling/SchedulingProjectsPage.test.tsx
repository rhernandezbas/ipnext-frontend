import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SchedulingProjectsPage from '@/pages/scheduling/SchedulingProjectsPage';

vi.mock('@/hooks/useScheduling', () => ({
  useTasks: vi.fn(),
}));

import { useTasks } from '@/hooks/useScheduling';

const mockTasks = [
  { id: '1', title: 'Instalación A', category: 'installation' as const, status: 'in_progress' as const, priority: 'high' as const, assignedTo: 'Juan', scheduledDate: '2026-04-28', scheduledTime: '10:00', description: '', assignedToId: 'u1', clientId: null, clientName: null, estimatedHours: 2, address: '', coordinates: null, completedAt: null, notes: '' },
  { id: '2', title: 'Reparación B', category: 'repair' as const, status: 'completed' as const, priority: 'normal' as const, assignedTo: 'Ana', scheduledDate: '2026-04-27', scheduledTime: '09:00', description: '', assignedToId: 'u2', clientId: null, clientName: null, estimatedHours: 1, address: '', coordinates: null, completedAt: '2026-04-27T12:00:00Z', notes: '' },
  { id: '3', title: 'Mantenimiento C', category: 'maintenance' as const, status: 'pending' as const, priority: 'low' as const, assignedTo: 'Pedro', scheduledDate: '2026-04-29', scheduledTime: '14:00', description: '', assignedToId: 'u3', clientId: null, clientName: null, estimatedHours: 3, address: '', coordinates: null, completedAt: null, notes: '' },
];

describe('SchedulingProjectsPage', () => {
  beforeEach(() => {
    vi.mocked(useTasks).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    } as ReturnType<typeof useTasks>);
  });

  it('renders heading "Proyectos"', () => {
    render(<MemoryRouter><SchedulingProjectsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Proyectos/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useTasks>);
    render(<MemoryRouter><SchedulingProjectsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Proyectos/i })).toBeInTheDocument();
  });

  it('renders KPI cards', () => {
    render(<MemoryRouter><SchedulingProjectsPage /></MemoryRouter>);
    const kpiGrid = screen.getByLabelText('KPI cards');
    expect(kpiGrid).toBeInTheDocument();
    expect(screen.getByText('Total tareas')).toBeInTheDocument();
    expect(screen.getByText('Tareas activas')).toBeInTheDocument();
    expect(screen.getByText('Completadas')).toBeInTheDocument();
  });
});
