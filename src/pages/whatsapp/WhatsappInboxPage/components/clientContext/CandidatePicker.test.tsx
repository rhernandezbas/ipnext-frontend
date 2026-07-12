import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { CandidatePicker } from './CandidatePicker';
import type { WhatsappClientContextClient } from '@/types/whatsapp';

const CLIENTS: WhatsappClientContextClient[] = [
  { id: '1', name: 'Juan Perez', status: 'active' },
  { id: '2', name: 'Juan P.', status: 'late' },
];

function renderPicker(onChoose = vi.fn()) {
  return {
    onChoose,
    ...render(
      <MemoryRouter>
        <CandidatePicker clients={CLIENTS} onChoose={onChoose} />
      </MemoryRouter>,
    ),
  };
}

describe('CandidatePicker (messaging-inbox-v2 F1.5, design §1/§5.0)', () => {
  it('lista nombre + link "Ver perfil" por candidato (contrato heredado del ClientContextPanel histórico)', () => {
    renderPicker();

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Juan P.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /ver perfil/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/admin/customers/view/1');
    expect(links[1]).toHaveAttribute('href', '/admin/customers/view/2');
  });

  it('cada candidato tiene un botón "Elegir"', () => {
    renderPicker();
    expect(screen.getAllByRole('button', { name: /elegir/i })).toHaveLength(2);
  });

  it('clickear "Elegir" del 2do candidato invoca onChoose con su id', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    renderPicker(onChoose);

    const buttons = screen.getAllByRole('button', { name: /elegir/i });
    await user.click(buttons[1]!);

    expect(onChoose).toHaveBeenCalledWith('2');
  });
});
