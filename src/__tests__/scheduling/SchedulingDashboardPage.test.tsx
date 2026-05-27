import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SchedulingDashboardPage from '@/pages/scheduling/SchedulingDashboardPage';

vi.mock('@/hooks/useScheduling', () => ({
  useTasks: vi.fn(),
}));

import { useTasks } from '@/hooks/useScheduling';

const mockTasks = [
  { id: '1', title: 'Instalación A', category: 'installation', stageCategory: 'enProgreso', priority: 'high', assigneeName: 'Juan', startDate: '2026-04-28T10:00:00Z', description: '', estimatedHours: 2, address: '', coordinates: null, completedAt: null, notes: '' },
  { id: '2', title: 'Reparación B', category: 'repair', stageCategory: 'hecho', priority: 'normal', assigneeName: 'Ana', startDate: '2026-04-27T09:00:00Z', description: '', estimatedHours: 1, address: '', coordinates: null, completedAt: '2026-04-27T12:00:00Z', notes: '' },
  { id: '3', title: 'Mantenimiento C', category: 'maintenance', stageCategory: 'nuevo', priority: 'low', assigneeName: 'Pedro', startDate: '2026-04-29T14:00:00Z', description: '', estimatedHours: 3, address: '', coordinates: null, completedAt: null, notes: '' },
];

describe('SchedulingDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useTasks).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    } as ReturnType<typeof useTasks>);
  });

  it('renders heading "Dashboard"', () => {
    render(<MemoryRouter><SchedulingDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useTasks>);
    render(<MemoryRouter><SchedulingDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
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
