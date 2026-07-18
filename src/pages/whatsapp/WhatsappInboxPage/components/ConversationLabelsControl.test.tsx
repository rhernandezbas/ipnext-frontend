/**
 * ConversationLabelsControl — multi-select de etiquetas del header del thread
 * (Ola 5 — labels). Presentacional puro: recibe `labels`/`selectedIds` como
 * props, dispara `onChange` con el set COMPLETO de objetos elegidos (el caller
 * lo reenvía a `useSetConversationLabels(id).setLabels`; el PATCH reemplaza el
 * set). `WhatsappInboxPage` lo monta bajo `<Can permission="messaging.send">`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationLabelsControl } from './ConversationLabelsControl';
import type { WhatsappLabel } from '@/types/whatsapp';

const LABELS: WhatsappLabel[] = [
  { id: 'l1', name: 'Urgente', color: '#dc3545' },
  { id: 'l2', name: 'Ventas', color: '#28a745' },
  { id: 'l3', name: 'Postventa', color: '#0d6efd' },
];

async function openPopover() {
  await userEvent.click(screen.getByRole('button', { name: /etiquetas de la conversación/i }));
}

describe('ConversationLabelsControl — apertura y estado', () => {
  it('el trigger abre el popover con un checkbox por etiqueta del catálogo', async () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={[]} />);
    expect(screen.queryByRole('checkbox')).toBeNull();

    await openPopover();

    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /ventas/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /postventa/i })).toBeInTheDocument();
  });

  it('marca como checked las etiquetas ya asignadas (selectedIds)', async () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={['l2']} />);
    await openPopover();

    expect(screen.getByRole('checkbox', { name: /ventas/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /urgente/i })).not.toBeChecked();
  });

  it('muestra el contador de etiquetas seleccionadas en el trigger', () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={['l1', 'l2']} />);
    expect(screen.getByRole('button', { name: /etiquetas de la conversación/i })).toHaveTextContent('2');
  });

  it('con catálogo vacío, muestra un aviso (no un popover mudo)', async () => {
    render(<ConversationLabelsControl labels={[]} selectedIds={[]} />);
    await openPopover();
    expect(screen.getByText(/no hay etiquetas/i)).toBeInTheDocument();
  });
});

describe('ConversationLabelsControl — toggle (reemplaza el set completo)', () => {
  it('marcar una etiqueta nueva dispara onChange con el set COMPLETO (previas + nueva) de objetos', async () => {
    const onChange = vi.fn();
    render(<ConversationLabelsControl labels={LABELS} selectedIds={['l1']} onChange={onChange} />);
    await openPopover();

    await userEvent.click(screen.getByRole('checkbox', { name: /ventas/i }));

    expect(onChange).toHaveBeenCalledWith([
      { id: 'l1', name: 'Urgente', color: '#dc3545' },
      { id: 'l2', name: 'Ventas', color: '#28a745' },
    ]);
  });

  it('desmarcar una etiqueta ya asignada la saca del set', async () => {
    const onChange = vi.fn();
    render(<ConversationLabelsControl labels={LABELS} selectedIds={['l1', 'l2']} onChange={onChange} />);
    await openPopover();

    await userEvent.click(screen.getByRole('checkbox', { name: /urgente/i }));

    expect(onChange).toHaveBeenCalledWith([{ id: 'l2', name: 'Ventas', color: '#28a745' }]);
  });

  it('desmarcar la última etiqueta dispara onChange([]) (limpia el set)', async () => {
    const onChange = vi.fn();
    render(<ConversationLabelsControl labels={LABELS} selectedIds={['l1']} onChange={onChange} />);
    await openPopover();

    await userEvent.click(screen.getByRole('checkbox', { name: /urgente/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('el popover NO se cierra al togglear (multi-select: se marcan varias seguidas)', async () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={[]} onChange={vi.fn()} />);
    await openPopover();

    await userEvent.click(screen.getByRole('checkbox', { name: /urgente/i }));

    expect(screen.getByRole('checkbox', { name: /ventas/i })).toBeInTheDocument();
  });
});

describe('ConversationLabelsControl — estado de carga y A11Y', () => {
  it('isPending deshabilita el trigger', () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={[]} isPending />);
    expect(screen.getByRole('button', { name: /etiquetas de la conversación/i })).toBeDisabled();
  });

  it('el trigger es alcanzable por teclado y tiene nombre accesible', () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={[]} />);
    const trigger = screen.getByRole('button', { name: /etiquetas de la conversación/i });
    trigger.focus();
    expect(trigger).toHaveFocus();
  });

  it('Escape cierra el popover', async () => {
    render(<ConversationLabelsControl labels={LABELS} selectedIds={[]} />);
    await openPopover();
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
