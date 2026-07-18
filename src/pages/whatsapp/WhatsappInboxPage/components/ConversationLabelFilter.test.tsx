/**
 * ConversationLabelFilter — filtro de etiqueta del inbox (Ola 5 — labels).
 * Combobox propio (`Select` molecule), 100% controlado. "Todas las etiquetas"
 * mapea a `undefined` (limpia el filtro server-side); cada etiqueta setea su id.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationLabelFilter } from './ConversationLabelFilter';
import type { WhatsappLabel } from '@/types/whatsapp';

const LABELS: WhatsappLabel[] = [
  { id: 'l1', name: 'Urgente', color: '#dc3545' },
  { id: 'l2', name: 'Ventas', color: '#28a745' },
];

describe('ConversationLabelFilter', () => {
  it('renderiza el combobox propio con nombre accesible', () => {
    render(<ConversationLabelFilter labels={LABELS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /filtrar conversaciones por etiqueta/i })).toBeInTheDocument();
  });

  it('sin value, muestra "Todas las etiquetas"', () => {
    render(<ConversationLabelFilter labels={LABELS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /etiqueta/i })).toHaveTextContent(/todas las etiquetas/i);
  });

  it('elegir una etiqueta dispara onChange con su id', async () => {
    const onChange = vi.fn();
    render(<ConversationLabelFilter labels={LABELS} value={undefined} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: /etiqueta/i }));
    await userEvent.click(screen.getByRole('option', { name: /ventas/i }));

    expect(onChange).toHaveBeenCalledWith('l2');
  });

  it('elegir "Todas las etiquetas" dispara onChange(undefined) (limpia el filtro)', async () => {
    const onChange = vi.fn();
    render(<ConversationLabelFilter labels={LABELS} value="l1" onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: /etiqueta/i }));
    await userEvent.click(screen.getByRole('option', { name: /todas las etiquetas/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('con value seteado, el trigger muestra esa etiqueta', () => {
    render(<ConversationLabelFilter labels={LABELS} value="l1" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /etiqueta/i })).toHaveTextContent(/urgente/i);
  });
});
