/**
 * ResultingStageSelect tests — bulk-task-stage-transition FE (FE-TRANS-1): el Select
 * PROPIO del estado resultante único global. Cubre: render del valor actual, apertura
 * del listbox, EXCLUSIÓN de send_to_iclass (decisión 7), pick de un estado y pick de
 * "— Sin transición —" (null), y no-op al re-elegir el valor actual.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { ResultingStageSelect } from '@/components/settings/ResultingStageSelect';
import type { WorkflowStage } from '@/types/workflow';

function stage(id: string, name: string, code: string, order: number): WorkflowStage {
  return { id, workflowId: 'w1', name, code, category: 'enProgreso', order, color: null };
}

const workflows = [
  {
    id: 'w1',
    name: 'Instalaciones',
    stages: [
      stage('sA', 'Pendiente aviso', 'pend', 1),
      stage('sB', 'Avisado', 'avisado', 2),
      stage('sIclass', 'Enviar a IClass', 'send_to_iclass', 3),
    ],
  },
];

describe('ResultingStageSelect', () => {
  it('muestra el valor actual en el trigger', () => {
    render(<ResultingStageSelect value="sB" valueName="Avisado" workflows={workflows} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Avisado/ })).toBeInTheDocument();
  });

  it('sin valor → muestra "— Sin transición —"', () => {
    render(<ResultingStageSelect value={null} valueName={null} workflows={workflows} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Sin transición/ })).toBeInTheDocument();
  });

  it('abre el listbox y EXCLUYE send_to_iclass de las opciones', async () => {
    const user = userEvent.setup();
    render(<ResultingStageSelect value={null} valueName={null} workflows={workflows} onPick={vi.fn()} />);
    await user.click(screen.getByRole('button'));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /Pendiente aviso/ })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /Avisado/ })).toBeInTheDocument();
    // send_to_iclass NUNCA aparece
    expect(within(listbox).queryByRole('option', { name: /Enviar a IClass/ })).not.toBeInTheDocument();
  });

  it('elegir un estado llama onPick(stageId)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ResultingStageSelect value={null} valueName={null} workflows={workflows} onPick={onPick} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Avisado/ }));
    expect(onPick).toHaveBeenCalledWith('sB');
  });

  it('elegir "Sin transición" llama onPick(null)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ResultingStageSelect value="sB" valueName="Avisado" workflows={workflows} onPick={onPick} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Sin transición/ }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('re-elegir el valor actual NO llama onPick (no-op)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ResultingStageSelect value="sB" valueName="Avisado" workflows={workflows} onPick={onPick} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Avisado/ }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('el trigger expone aria-haspopup listbox y aria-expanded', async () => {
    const user = userEvent.setup();
    render(<ResultingStageSelect value={null} valueName={null} workflows={workflows} onPick={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
