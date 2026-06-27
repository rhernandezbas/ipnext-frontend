import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StageSelect } from '@/components/molecules/StageSelect/StageSelect';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';

const stages: WorkflowStage[] = [
  { id: 's1', workflowId: 'wf1', name: 'Nuevo', code: 'nuevo', category: 'nuevo', order: 0 },
  { id: 's2', workflowId: 'wf1', name: 'Confirmado', code: 'nuevo-2', category: 'nuevo', order: 1, color: '#22c55e' },
];

const task = { id: 't1', stageId: 's1', stageCategory: 'nuevo' } as unknown as ScheduledTask;

describe('StageSelect', () => {
  let onMove: (stageId: string) => Promise<unknown>;
  beforeEach(() => {
    onMove = vi.fn().mockResolvedValue(undefined) as unknown as (stageId: string) => Promise<unknown>;
  });

  it('shows the current stage name on the trigger', () => {
    render(<StageSelect task={task} stages={stages} onMove={onMove} />);
    expect(screen.getByLabelText('Cambiar estado')).toHaveTextContent('Nuevo');
  });

  it('lists every stage as an option when opened', () => {
    render(<StageSelect task={task} stages={stages} onMove={onMove} />);
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    expect(screen.getByRole('option', { name: /Nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Confirmado/ })).toBeInTheDocument();
  });

  it('calls onMove with the picked stage id', async () => {
    render(<StageSelect task={task} stages={stages} onMove={onMove} />);
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    fireEvent.click(screen.getByRole('option', { name: /Confirmado/ }));
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('s2'));
  });

  it('does not call onMove when picking the current stage', async () => {
    render(<StageSelect task={task} stages={stages} onMove={onMove} />);
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    fireEvent.click(screen.getByRole('option', { name: /Nuevo/ }));
    await waitFor(() => expect(onMove).not.toHaveBeenCalled());
  });

  it('falls back to a read-only badge when there are no stages', () => {
    render(<StageSelect task={task} stages={[]} onMove={onMove} />);
    expect(screen.queryByLabelText('Cambiar estado')).not.toBeInTheDocument();
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<StageSelect task={task} stages={stages} onMove={onMove} disabled />);
    const trigger = screen.getByLabelText('Cambiar estado');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
