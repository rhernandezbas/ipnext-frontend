import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const moveAsync = vi.fn();
vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage: () => ({ mutateAsync: moveAsync, isPending: false }),
  useDeleteTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import type { ScheduledTask } from '@/types/scheduling';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';

const workflows: Workflow[] = [{
  id: 'wf1', name: 'Default', description: null, createdAt: '', updatedAt: '',
  stages: [
    { id: 's2', workflowId: 'wf1', name: 'Confirmado', category: 'nuevo', order: 1 },
    { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
  ],
}];
const projects: Project[] = [{ id: 'p1', title: 'Fibra', description: null, workflowId: 'wf1', createdAt: '', updatedAt: '' }];

const task = {
  id: 't1', sequenceNumber: 1, title: 'Tarea', stageId: 's1', stageCategory: 'nuevo',
  projectId: 'p1', priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  description: null, watcherIds: [], checklist: [],
  customerId: 'cust-9', customerName: 'ACOSTA JUAN PABLO',
} as unknown as ScheduledTask;

function setup(columns: string[] = ['sequenceNumber', 'stageCategory']) {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={[task]} projects={projects} workflows={workflows} visibleColumnKeys={columns} />
    </MemoryRouter>,
  );
}

describe('TasksTableView — inline estado selector', () => {
  beforeEach(() => { vi.clearAllMocks(); moveAsync.mockResolvedValue(undefined); });

  it('shows the real stage name on the trigger and lists colour-coded options when opened', () => {
    setup();
    const trigger = screen.getByLabelText('Cambiar estado');
    expect(trigger).toHaveTextContent('Nuevo'); // current stage name, not the category
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: /Nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Confirmado/ })).toBeInTheDocument();
  });

  it('moves the task to the chosen stage when an option is picked', async () => {
    setup();
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    fireEvent.click(screen.getByRole('option', { name: /Confirmado/ }));
    await waitFor(() => expect(moveAsync).toHaveBeenCalledWith({ id: 't1', stageId: 's2' }));
  });

  it('renders the customer name as a link to the customer detail page', () => {
    setup(['sequenceNumber', 'customerName']);
    const link = screen.getByRole('link', { name: 'ACOSTA JUAN PABLO' });
    expect(link).toHaveAttribute('href', '/admin/customers/view/cust-9');
  });
});
