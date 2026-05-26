import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectModal } from '@/pages/scheduling/SchedulingProjectsPage';
import type { Project } from '@/types/project';

const workflows = [
  { id: 'wf-1', name: 'Default' },
  { id: 'wf-2', name: 'Fibra' },
];

describe('ProjectModal — workflow selector', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  function setup(initial?: Project) {
    return render(
      <ProjectModal initial={initial} workflows={workflows} onClose={onClose} onSave={onSave} loading={false} />,
    );
  }

  it('renders a workflow select with a "Sin workflow" option plus every workflow', () => {
    setup();
    const select = screen.getByLabelText(/workflow/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sin workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Default' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fibra' })).toBeInTheDocument();
  });

  it('preselects the workflow of the project being edited', () => {
    const project: Project = {
      id: 'p1', title: 'Proyecto', description: null, workflowId: 'wf-2', createdAt: '', updatedAt: '',
    };
    setup(project);
    const select = screen.getByLabelText(/workflow/i) as HTMLSelectElement;
    expect(select.value).toBe('wf-2');
  });

  it('saves the chosen workflowId', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Nombre del proyecto'), { target: { value: 'Nuevo Proy' } });
    fireEvent.change(screen.getByLabelText(/workflow/i), { target: { value: 'wf-1' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuevo Proy', workflowId: 'wf-1' }));
  });

  it('saves workflowId as null when "Sin workflow" stays selected', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Nombre del proyecto'), { target: { value: 'Sin wf' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sin wf', workflowId: null }));
  });
});
