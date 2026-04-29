import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as SchedulingPage } from '@/pages/empresa/SchedulingPage';
import * as useSchedulingModule from '@/hooks/useScheduling';
import type { ScheduledTask } from '@/types/scheduling';

vi.mock('@/hooks/useScheduling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTasks: ScheduledTask[] = [
  {
    id: '1',
    title: 'Instalación fibra óptica - García',
    description: 'Instalación de servicio de fibra óptica residencial',
    assignedTo: 'Carlos Técnico',
    assignedToId: 'admin-1',
    clientId: 'cli-001',
    clientName: 'Juan García',
    status: 'pending',
    priority: 'high',
    scheduledDate: '2026-05-02',
    scheduledTime: '09:00',
    estimatedHours: 3,
    address: 'Av. Corrientes 1234, CABA',
    coordinates: null,
    category: 'installation',
    completedAt: null,
    notes: '',
  },
  {
    id: '2',
    title: 'Reparación de señal - López',
    description: 'Cliente reporta pérdida intermitente',
    assignedTo: 'María Técnica',
    assignedToId: 'admin-2',
    clientId: 'cli-002',
    clientName: 'Roberto López',
    status: 'in_progress',
    priority: 'urgent',
    scheduledDate: '2026-04-28',
    scheduledTime: '10:30',
    estimatedHours: 2,
    address: 'San Martín 567',
    coordinates: null,
    category: 'repair',
    completedAt: null,
    notes: '',
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <SchedulingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchedulingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSchedulingModule.useTasks).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    } as ReturnType<typeof useSchedulingModule.useTasks>);

    vi.mocked(useSchedulingModule.useCreateTask).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSchedulingModule.useCreateTask>);

    vi.mocked(useSchedulingModule.useUpdateTask).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSchedulingModule.useUpdateTask>);

    vi.mocked(useSchedulingModule.useUpdateTaskStatus).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSchedulingModule.useUpdateTaskStatus>);

    vi.mocked(useSchedulingModule.useDeleteTask).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSchedulingModule.useDeleteTask>);
  });

  it('renders "Scheduling" or "Tareas" heading', () => {
    renderPage();
    expect(screen.getByText(/scheduling|tareas/i)).toBeInTheDocument();
  });

  it('renders "Nueva tarea" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument();
  });

  it('task table shows task titles from mock', () => {
    renderPage();
    expect(screen.getByText('Instalación fibra óptica - García')).toBeInTheDocument();
    expect(screen.getByText('Reparación de señal - López')).toBeInTheDocument();
  });

  it('priority filter exists', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /prioridad/i });
    expect(select).toBeInTheDocument();
  });

  it('status filter exists', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeInTheDocument();
  });

  it('clicking "Nueva tarea" shows form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calendar view toggle button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /calendario/i })).toBeInTheDocument();
  });

  it('"Completar" button is present in task rows for non-completed tasks', () => {
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /completar/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('"Editar" button is present in task rows', () => {
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /editar/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('"Eliminar" button is present in task rows', () => {
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /eliminar/i });
    expect(buttons.length).toBeGreaterThan(0);
  });
});
