import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PrioritySelect } from '@/components/molecules/PrioritySelect/PrioritySelect';
import type { TaskPriority } from '@/types/taskPriority';

const priorities: TaskPriority[] = [
  { id: 'p1', name: 'normal', color: '#3b82f6', weight: 1 },
  { id: 'p2', name: 'high',   color: '#f59e0b', weight: 2 },
  { id: 'p3', name: 'urgent', color: '#ef4444', weight: 3 },
];

describe('PrioritySelect', () => {
  let onChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onChange = vi.fn().mockResolvedValue(undefined);
  });

  it('shows the current priority name on the trigger', () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} />);
    expect(screen.getByLabelText('Cambiar prioridad')).toHaveTextContent('high');
  });

  it('lists every priority as an option when opened', () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Cambiar prioridad'));
    expect(screen.getByRole('option', { name: /normal/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /high/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /urgent/ })).toBeInTheDocument();
  });

  it('calls onChange with the picked priority name', async () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Cambiar prioridad'));
    fireEvent.click(screen.getByRole('option', { name: /urgent/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('urgent'));
  });

  it('does not call onChange when picking the current priority', async () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Cambiar prioridad'));
    fireEvent.click(screen.getByRole('option', { name: /high/ }));
    await waitFor(() => expect(onChange).not.toHaveBeenCalled());
  });

  it('falls back to a read-only badge when there are no priorities', () => {
    render(<PrioritySelect value="high" priorities={[]} onChange={onChange} />);
    expect(screen.queryByLabelText('Cambiar prioridad')).not.toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} disabled />);
    const trigger = screen.getByLabelText('Cambiar prioridad');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('marks the current priority option as aria-selected', () => {
    render(<PrioritySelect value="high" priorities={priorities} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Cambiar prioridad'));
    expect(screen.getByRole('option', { name: /high/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /urgent/ })).toHaveAttribute('aria-selected', 'false');
  });
});
