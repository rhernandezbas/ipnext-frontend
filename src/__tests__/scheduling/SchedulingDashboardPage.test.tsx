import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SchedulingDashboardPage from '@/pages/scheduling/SchedulingDashboardPage';

vi.mock('@/hooks/useScheduling', () => ({
  useTasks: vi.fn(),
}));

import { useTasks } from '@/hooks/useScheduling';

const mockTasks = [
  { id: '1', title: 'Instalación A', category: 'installation', status: 'in_progress', priority: 'high', assignedTo: 'Juan', scheduledDate: '2026-04-28', scheduledTime: '10:00', description: '', assignedToId: 'u1', clientId: null, clientName: null, estimatedHours: 2, address: '', coordinates: null, completedAt: null, notes: '' },
  { id: '2', title: 'Reparación B', category: 'repair', status: 'completed', priority: 'normal', assignedTo: 'Ana', scheduledDate: '2026-04-27', scheduledTime: '09:00', description: '', assignedToId: 'u2', clientId: null, clientName: null, estimatedHours: 1, address: '', coordinates: null, completedAt: '2026-04-27T12:00:00Z', notes: '' },
  { id: '3', title: 'Mantenimiento C', category: 'maintenance', status: 'pending', priority: 'low', assignedTo: 'Pedro', scheduledDate: '2026-04-29', scheduledTime: '14:00', description: '', assignedToId: 'u3', clientId: null, clientName: null, estimatedHours: 3, address: '', coordinates: null, completedAt: null, notes: '' },
];

describe('SchedulingDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useTasks).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    } as ReturnType<typeof useTasks>);
  });

  it('renders heading "Dashboard de Tareas"', () => {
    render(<MemoryRouter><SchedulingDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Dashboard de Tareas/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useTasks>);
    render(<MemoryRouter><SchedulingDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Dashboard de Tareas/i })).toBeInTheDocument();
  });

  it('KPI values are correct', () => {
    render(<MemoryRouter><SchedulingDashboardPage /></MemoryRouter>);
    const kpiGrid = screen.getByLabelText('KPI cards');
    expect(kpiGrid).toBeInTheDocument();
    // Total tareas = 3
    expect(screen.getByText('Tareas totales')).toBeInTheDocument();
    // En progreso = 1
    const enProgresoLabel = screen.getByText('En progreso');
    const card = enProgresoLabel.closest('[class*="kpiCard"]');
    const val = card?.querySelector('[class*="kpiValue"]');
    expect(val?.textContent).toBe('1');
  });
});
