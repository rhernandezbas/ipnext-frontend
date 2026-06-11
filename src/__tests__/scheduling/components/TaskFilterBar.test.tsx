import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Catalog hooks the bar reads — stub to empty so only the status select matters.
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }), PROJECTS_KEY: ['projects'] }));
vi.mock('@/hooks/usePartners', () => ({ usePartners: () => ({ data: [] }) }));
vi.mock('@/hooks/useRbacUsers', () => ({ useRbacUsers: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskPriorities', () => ({ useTaskPriorities: () => ({ data: [] }) }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflow: () => ({ data: undefined }) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import { TaskFilterBar } from '@/pages/scheduling/SchedulingTasksPage/components/TaskFilterBar';
import type { TaskListFilter } from '@/types/scheduling';

function setup(filter: TaskListFilter = { status: 'open' }) {
  const onFilterChange = vi.fn();
  render(
    <MemoryRouter>
      <TaskFilterBar
        filter={filter}
        view="table"
        onFilterChange={onFilterChange}
        onViewChange={vi.fn()}
      />
    </MemoryRouter>,
  );
  return { onFilterChange };
}

describe('TaskFilterBar — general status (#41)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the status select with the four options', () => {
    setup();
    const select = screen.getByLabelText('Estado general');
    expect(select).toBeInTheDocument();
    const labels = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(labels).toEqual(['Abiertas', 'Cerradas', 'Descartadas', 'Todas']);
  });

  it('defaults the select value to open', () => {
    setup({ status: 'open' });
    expect((screen.getByLabelText('Estado general') as HTMLSelectElement).value).toBe('open');
  });

  it('calls onFilterChange with the chosen status', () => {
    const { onFilterChange } = setup({ status: 'open' });
    fireEvent.change(screen.getByLabelText('Estado general'), { target: { value: 'closed' } });
    expect(onFilterChange).toHaveBeenCalledWith({ status: 'closed' });
  });

  it('shows a chip when status is not open', () => {
    setup({ status: 'closed' });
    expect(screen.getByText('Estado general: Cerradas')).toBeInTheDocument();
  });

  it('does NOT show a status chip when status is open', () => {
    setup({ status: 'open' });
    expect(screen.queryByText(/Estado general:/)).not.toBeInTheDocument();
  });

  it('removing the status chip resets status to open', () => {
    const { onFilterChange } = setup({ status: 'dismissed' });
    fireEvent.click(screen.getByLabelText('Quitar filtro Estado general: Descartadas'));
    expect(onFilterChange).toHaveBeenCalledWith({ status: 'open' });
  });

  it('"Limpiar todo" includes status:open in the reset patch', () => {
    const { onFilterChange } = setup({ status: 'closed', q: 'x' });
    fireEvent.click(screen.getByText('Limpiar todo'));
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' }),
    );
  });
});
